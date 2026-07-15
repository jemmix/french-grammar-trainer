import { argon2id } from "hash-wasm";
import { env } from "~/config/env";

export async function mangleUserId(sub: string): Promise<string> {
  if (!env.hmacKey) {
    throw new Error("HMAC_KEY environment variable is required");
  }
  return argon2id({
    password: sub,
    salt: env.hmacKey,
    parallelism: 1,
    iterations: 3,
    memorySize: 65536, // 64 MB — GPU/ASIC-resistant
    hashLength: 32,
    outputType: "hex",
  });
}
