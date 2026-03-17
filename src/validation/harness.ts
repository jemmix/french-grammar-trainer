import { execFile } from "child_process";
import type { LLMRequestSpec, LLMResponse } from "./types";

const HARNESS_TIMEOUT_MS = 300_000;

export interface LLMHarness {
  name: string;
  run(spec: LLMRequestSpec, nonce: string): Promise<LLMResponse>;
}

export const opencodeHarness: LLMHarness = {
  name: "opencode",

  async run(spec: LLMRequestSpec, nonce: string): Promise<LLMResponse> {
    const fullPrompt = spec.systemPrompt + "\n\n" + nonce + "\n\n" + spec.userPrompt;

    return new Promise((resolve, reject) => {
      const child = execFile(
        "opencode",
        ["run", "--model", "zai-coding-plan/glm-5", fullPrompt],
        { timeout: HARNESS_TIMEOUT_MS, maxBuffer: 10 * 1024 },
        (err, stdout, stderr) => {
          if (err) {
            const isTimeout = err.message.includes("ETIMEDOUT") || (err as any).killed;
            const parts: string[] = ["opencode failed"];
            if (isTimeout) {
              parts.push("reason: timeout after " + (HARNESS_TIMEOUT_MS / 1000) + "s");
            } else if ((err as any).code !== undefined) {
              parts.push("reason: exit code " + (err as any).code);
            } else {
              parts.push("reason: " + err.message);
            }
            if (stderr?.trim()) parts.push("stderr: " + stderr.trim());
            if (stdout?.trim()) parts.push("stdout: " + stdout.trim());
            reject(new Error(parts.join("\n")));
            return;
          }
          const raw = stdout.trim();
          resolve({
            raw,
            model: "glm-5",
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

export function parseVerdict(raw: string): "TRUE" | "FALSE" | "UNCLEAR" | "PARSE_ERROR" {
  const upper = raw.toUpperCase().trim();
  if (upper === "TRUE") return "TRUE";
  if (upper === "FALSE") return "FALSE";
  if (upper === "UNCLEAR") return "UNCLEAR";
  const match = raw.match(/\b(TRUE|FALSE|UNCLEAR)\b/i);
  if (match) return match[1]!.toUpperCase() as "TRUE" | "FALSE" | "UNCLEAR";
  return "PARSE_ERROR";
}
