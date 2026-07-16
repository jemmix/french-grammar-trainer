import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "~": resolve(__dirname, "src"),
    },
  },
  test: {
    // Some tests dynamically import compiled TS section files, which can take
    // a while under CPU contention. Default is 5s; bump to 5 min.
    testTimeout: 300_000,
    exclude: ["**/node_modules/**", "**/dist/**", "tests/integration/**"],
  },
});
