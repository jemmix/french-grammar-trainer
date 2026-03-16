import { execFile } from "child_process";
import type { LLMRequestSpec, LLMResponse } from "./types";

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
        { timeout: 60_000, maxBuffer: 10 * 1024 },
        (err, stdout, stderr) => {
          if (err) {
            reject(new Error("opencode failed: " + err.message + "\nstderr: " + stderr));
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
