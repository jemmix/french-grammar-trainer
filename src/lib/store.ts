export interface UserStore {
  get(userId: string): Promise<Uint8Array | null>;
  put(userId: string, data: Uint8Array): Promise<void>;
  delete(userId: string): Promise<void>;
}

let cached: UserStore | null = null;

/**
 * Returns S3 store when S3_ENDPOINT is configured, otherwise SQLite (dev).
 * Lazy-loaded and cached to avoid re-importing on every call.
 */
export async function getStore(): Promise<UserStore> {
  if (cached) return cached;

  if (process.env.S3_ENDPOINT) {
    const { s3Store } = await import("./s3-store");
    cached = s3Store;
  } else {
    const { sqliteStore } = await import("./sqlite-store");
    // Wrap sync methods as async
    cached = {
      get: async (userId) => sqliteStore.get(userId),
      put: async (userId, data) => sqliteStore.put(userId, data),
      delete: async (userId) => sqliteStore.delete(userId),
    };
  }
  return cached;
}
