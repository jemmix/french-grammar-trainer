import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Some tests dynamically import compiled TS section files, which can take
    // a while under CPU contention. Default is 5s; bump to 5 min.
    testTimeout: 300_000,
  },
});
