import { argon2id } from "hash-wasm";

// Deterministic dev salt — not a secret, used only to stabilize the hash
const DEV_SALT = "fgt-dev-salt-32-bytes-padding!!";

export async function mangleUserId(sub: string): Promise<string> {
  return argon2id({
    password: sub,
    salt: DEV_SALT,
    parallelism: 1,
    iterations: 1,
    memorySize: 4096,
    hashLength: 32,
    outputType: "hex",
  });
}
