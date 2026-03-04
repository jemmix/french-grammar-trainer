import { argon2id } from "hash-wasm";

function getSalt(): string {
  const key = process.env.HMAC_KEY;
  if (!key) {
    throw new Error("HMAC_KEY environment variable is required");
  }
  return key;
}

export async function mangleUserId(sub: string): Promise<string> {
  return argon2id({
    password: sub,
    salt: getSalt(),
    parallelism: 1,
    iterations: 3,
    memorySize: 65536, // 64 MB — GPU/ASIC-resistant
    hashLength: 32,
    outputType: "hex",
  });
}
