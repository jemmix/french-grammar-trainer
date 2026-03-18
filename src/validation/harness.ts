import { execFile } from "child_process";
import type { ExecFileException } from "child_process";
import type { LLMRequestSpec, LLMResponse } from "./types";

const HARNESS_TIMEOUT_MS = 300_000;
const MAX_RETRIES = 3;
const INITIAL_DELAY_MS = 1000;
const MAX_DELAY_MS = 30000;
const BACKOFF_MULTIPLIER = 2;

export interface LLMHarness {
  name: string;
  run(spec: LLMRequestSpec, nonce: string): Promise<LLMResponse>;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function calculateDelay(attempt: number): number {
  const baseDelay = INITIAL_DELAY_MS * Math.pow(BACKOFF_MULTIPLIER, attempt);
  const jitter = Math.random() * baseDelay * 0.3;
  return Math.min(baseDelay + jitter, MAX_DELAY_MS);
}

function isRetryableError(err: Error): boolean {
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

async function runWithRetry<T>(
  fn: () => Promise<T>,
  options: { maxRetries: number; operation: string }
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      if (attempt === options.maxRetries) {
        break;
      }

      if (!isRetryableError(lastError)) {
        throw lastError;
      }

      const delay = calculateDelay(attempt);
      console.warn(
        `${options.operation} failed (attempt ${attempt + 1}/${options.maxRetries + 1}), ` +
        `retrying in ${Math.round(delay)}ms: ${lastError.message.split("\n")[0]}`
      );
      await sleep(delay);
    }
  }

  throw lastError;
}

export function createOpencodeHarness(modelId: string): LLMHarness {
  return {
    name: "opencode",

    async run(spec: LLMRequestSpec, nonce: string): Promise<LLMResponse> {
      const fullPrompt = spec.systemPrompt + "\n\n" + nonce + "\n\n" + spec.userPrompt;

      return runWithRetry(
        () =>
          new Promise<LLMResponse>((resolve, reject) => {
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
                  reject(new Error(parts.join("\n")));
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
          }),
        { maxRetries: MAX_RETRIES, operation: "opencode LLM call" }
      );
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
