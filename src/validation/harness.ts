import { execFile } from "child_process";
import { readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import type { ExecFileException } from "child_process";
import type { LLMRequestSpec, LLMResponse } from "./types";

const HARNESS_TIMEOUT_MS = 600_000;

export class InvalidResponseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidResponseError";
  }
}

const PERMANENT_ERROR_PATTERNS = [
  "401",
  "403",
  "unauthorized",
  "authentication",
  "invalid api key",
  "invalid_api_key",
  "model not found",
  "unknown model",
  "invalid model",
];

export function isRetryableError(err: Error): boolean {
  if (err instanceof InvalidResponseError) return true;
  const msg = err.message.toLowerCase();

  // Known permanent errors (auth, config) — fail fast.
  for (const pattern of PERMANENT_ERROR_PATTERNS) {
    if (msg.includes(pattern)) return false;
  }

  // Known transient errors — explicit matches for clarity and to short-circuit.
  if (msg.includes("timeout")) return true;
  if (msg.includes("etimedout")) return true;
  if (msg.includes("econnreset")) return true;
  if (msg.includes("econnrefused")) return true;
  if (msg.includes("enotfound")) return true;
  if (msg.includes("429")) return true;
  if (msg.includes("rate limit")) return true;
  if (msg.includes("502")) return true;
  if (msg.includes("503")) return true;
  if (msg.includes("504")) return true;
  if (msg.includes("overloaded")) return true;
  if (msg.includes("empty response")) return true;
  if (msg.includes("signal:")) return true;
  if (msg.includes("killed")) return true;
  if (msg.includes("crashed")) return true;
  if (msg.includes("maxbuffer")) return true;

  // Default: treat any other failure (including all non-zero exit codes,
  // TLS/certificate errors, "fetch failed", etc.) as retryable. opencode is a
  // black box that can fail transiently in many ways we haven't enumerated.
  return true;
}

export interface LLMHarness {
  name: string;
  run(spec: LLMRequestSpec, nonce: string): Promise<LLMResponse>;
}

export function createOpencodeHarness(modelId: string, variant?: string): LLMHarness {
  // Bare model ids ("glm-5") are prefixed with the default provider;
  // full ids ("openrouter/stealth/ox-alpha") are passed through as-is.
  const fullModelId = modelId.includes("/") ? modelId : "zai-coding-plan/" + modelId;

  return {
    name: "opencode",

    async run(spec: LLMRequestSpec, nonce: string): Promise<LLMResponse> {
      const fullPrompt = spec.systemPrompt + "\n\n" + nonce + "\n\n" + spec.userPrompt;

      const args = ["run", "--agent", "validation-judge", "--model", fullModelId];
      if (variant) {
        args.push("--variant", variant);
      }
      args.push(fullPrompt);

      return new Promise<LLMResponse>((resolve, reject) => {
        const child = execFile(
          "opencode",
          args,
          { timeout: HARNESS_TIMEOUT_MS, maxBuffer: 10 * 1024 },
          (err, stdout, stderr) => {
            if (err) {
              const isTimeout = err.message.includes("ETIMEDOUT") || err.killed;
              const parts: string[] = ["opencode failed"];
              if (isTimeout) {
                parts.push("reason: timeout after " + (HARNESS_TIMEOUT_MS / 1000) + "s");
              } else if (err.code !== undefined && err.code !== null) {
                parts.push("reason: exit code " + err.code);
              } else if (err.signal) {
                parts.push("reason: killed by signal " + err.signal);
              } else {
                parts.push("reason: " + err.message);
              }
              if (stderr?.trim()) parts.push("stderr: " + stderr.trim());
              if (stdout?.trim()) parts.push("stdout: " + stdout.trim());
              reject(new Error(parts.join("; ")));
              return;
            }
            const raw = stdout.trim();
            if (!raw) {
              reject(new Error("opencode failed: empty response"));
              return;
            }
            resolve({
              raw,
              model: fullModelId,
              harness: "opencode",
              nonce,
              timestamp: new Date().toISOString(),
            });
          }
        );
        child.stdin?.end();
      });
    },
  };
}

export const opencodeHarness: LLMHarness = createOpencodeHarness("glm-5");

/**
 * Direct zai coding-plan API harness. Bypasses the opencode CLI, whose
 * per-call process spawn + session bookkeeping serializes throughput to
 * ~15 calls/min regardless of client concurrency. The zai API itself
 * parallelizes fine (8 concurrent calls complete in ~3s).
 *
 * Reads the API key from opencode's auth store (~/.local/share/opencode/
 * auth.json). Mirrors what opencode sends for zai-coding-plan over
 * @ai-sdk/openai-compatible: the variant becomes `reasoning_effort` and the
 * body always carries `thinking: { type: "enabled", clear_thinking: false }`.
 */
export function createZaiDirectHarness(modelId: string, variant?: string): LLMHarness {
  const endpoint = "https://api.z.ai/api/coding/paas/v4/chat/completions";
  const systemPrompt = [
    "You are a validation judge. Follow the instructions in the user prompt exactly.",
    "Respond in the exact format requested. Do not use any tools — respond with text only.",
  ].join(" ");

  return {
    name: "zai-direct",

    async run(spec: LLMRequestSpec, nonce: string): Promise<LLMResponse> {
      const fullPrompt = spec.systemPrompt + "\n\n" + nonce + "\n\n" + spec.userPrompt;
      const key = loadZaiKey();
      if (!key) {
        throw new Error(
          "zai-direct harness: no zai-coding-plan key in ~/.local/share/opencode/auth.json"
        );
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + key,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: modelId,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: fullPrompt },
          ],
          max_tokens: 4096,
          ...(variant ? { reasoning_effort: variant } : {}),
          thinking: { type: "enabled", clear_thinking: false },
        }),
        signal: AbortSignal.timeout(120_000),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error("zai-direct failed: HTTP " + res.status + "; " + body.slice(0, 300));
      }
      const data = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const raw = data.choices?.[0]?.message?.content?.trim() ?? "";
      if (!raw) {
        throw new Error("zai-direct failed: empty response");
      }
      return {
        raw,
        model: modelId,
        harness: "zai-direct",
        nonce,
        timestamp: new Date().toISOString(),
      };
    },
  };
}

function loadZaiKey(): string | null {
  try {
    const authPath = join(homedir(), ".local", "share", "opencode", "auth.json");
    const auth = JSON.parse(readFileSync(authPath, "utf-8")) as {
      "zai-coding-plan"?: { key?: string };
    };
    return auth["zai-coding-plan"]?.key ?? null;
  } catch {
    return null;
  }
}
