import { execFile } from "child_process";
import type { ExecFileException } from "child_process";
import type { LLMRequestSpec, LLMResponse } from "./types";

const HARNESS_TIMEOUT_MS = 300_000;

export class InvalidResponseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidResponseError";
  }
}

export function isRetryableError(err: Error): boolean {
  if (err instanceof InvalidResponseError) return true;
  const msg = err.message.toLowerCase();
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
  if (msg.includes("exit code null")) return true;
  if (msg.includes("signal:")) return true;
  if (msg.includes("killed")) return true;
  if (msg.includes("crashed")) return true;
  return false;
}

export interface LLMHarness {
  name: string;
  run(spec: LLMRequestSpec, nonce: string): Promise<LLMResponse>;
}

export function createOpencodeHarness(modelId: string): LLMHarness {
  return {
    name: "opencode",

    async run(spec: LLMRequestSpec, nonce: string): Promise<LLMResponse> {
      const fullPrompt = spec.systemPrompt + "\n\n" + nonce + "\n\n" + spec.userPrompt;

      return new Promise<LLMResponse>((resolve, reject) => {
        const child = execFile(
          "opencode",
          ["run", "--model", "zai-coding-plan/" + modelId, fullPrompt],
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
              model: modelId,
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

export function parseVerdict(raw: string): "TRUE" | "FALSE" | "UNCLEAR" | "PARSE_ERROR" {
  const upper = raw.toUpperCase().trim();
  if (upper === "TRUE") return "TRUE";
  if (upper === "FALSE") return "FALSE";
  if (upper === "UNCLEAR") return "UNCLEAR";
  const match = raw.match(/\b(TRUE|FALSE|UNCLEAR)\b/i);
  if (match) return match[1]!.toUpperCase() as "TRUE" | "FALSE" | "UNCLEAR";
  return "PARSE_ERROR";
}
