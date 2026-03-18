# OpenCode Integration Options

This document describes options for integrating OpenCode LLM calls into the French Grammar Trainer validation system.

## Current Implementation

The existing harness (`src/validation/harness.ts`) spawns a new `opencode run` process for each LLM call:

```typescript
execFile("opencode", ["run", "--model", "zai-coding-plan/" + modelId, fullPrompt], ...)
```

This works but has overhead: each call bootstraps and tears down the opencode runtime.

## Integration Options

### Option 1: Spawned Server (SDK)

Use `@opencode-ai/sdk` to spawn a persistent server process, then make HTTP requests to it.

```typescript
import { createOpencodeServer, createOpencodeClient } from "@opencode-ai/sdk";

// Start server once
const server = await createOpencodeServer({ port: 4096 });
const client = createOpencodeClient({ baseUrl: server.url });

// Create sessions and prompt
const session = await client.session.create({});
await client.session.prompt({
  sessionID: session.data.id,
  parts: [{ type: "text", text: prompt }],
});

// Cleanup when done
server.close();
```

**Pros:**

- Server persists across multiple calls
- Works from Node.js (no Bun required in host app)
- SDK handles server lifecycle

**Cons:**

- Orphan risk if host crashes (segfault, SIGKILL)
- Extra process to manage
- Network overhead

**Mitigation for orphan risk:**

- Use `AbortSignal` for graceful shutdown
- Add startup cleanup to kill stale opencode processes
- Use process supervisor (systemd, pm2)

### Option 2: In-Process (Bun Required)

Import opencode directly and run everything in-process. Requires Bun runtime.

```typescript
import { Instance } from "opencode/project/instance";
import { InstanceBootstrap } from "opencode/project/bootstrap";
import { Server } from "opencode/server/server";
import { createOpencodeClient } from "@opencode-ai/sdk";

async function runValidation(directory: string, prompts: string[]) {
  return Instance.provide({
    directory,
    init: InstanceBootstrap,
    fn: async () => {
      const fetchFn = async (input: RequestInfo | URL, init?: RequestInit) => {
        return Server.Default().fetch(new Request(input, init));
      };
      const client = createOpencodeClient({
        baseUrl: "http://internal",
        fetch: fetchFn,
      });

      // Run multiple prompts concurrently
      await Promise.all(prompts.map((p) => runPrompt(client, p)));
    },
  });
}

async function runPrompt(client, prompt: string) {
  const session = await client.session.create({});
  await client.session.prompt({
    sessionID: session.data.id,
    parts: [{ type: "text", text: prompt }],
  });
  // Subscribe to events for result...
}
```

**Pros:**

- No orphan risk (single process)
- Lower latency (no network hop)
- Session creation is cheap (~1ms, just a DB insert)

**Cons:**

- Requires Bun runtime
- Larger memory footprint (LSP servers, file watchers loaded)

### Option 3: Node.js Wrapper with Bun

For Node.js apps that want in-process performance, use a wrapper that exec's Bun:

```javascript
// scripts/validate-llm.js (Node.js entry point)
const { execFileSync } = require("child_process");
const path = require("path");

const bun = path.join(__dirname, "node_modules", ".bin", "bun");
const runner = path.join(__dirname, "validate-llm-runner.ts");

// Replace current process with bun
execFileSync(bun, ["run", runner, ...process.argv.slice(2)], {
  stdio: "inherit",
  env: process.env,
});
```

```json
// package.json
{
  "dependencies": {
    "bun": "^1.2"
  }
}
```

This gives true `execve` semantics on Unix — the Node process is replaced by Bun in the kernel's process table.

## Recommendations for This Project

Given the current architecture:

1. **Short-term**: Keep the current `execFile` approach. It's simple and works. The overhead is acceptable for batch validation runs.

2. **If orphan risk is a concern**: Add a startup check in `validate.ts`:

   ```typescript
   // Kill any stale opencode processes from previous crashed runs
   execFileSync("pkill", ["-f", "opencode serve"], { shell: true });
   ```

3. **If performance becomes critical**: Migrate to Option 3 (Node wrapper + Bun) for in-process execution. This would require:
   - Adding `bun` as a dependency
   - Creating a Bun-based runner that imports opencode directly
   - Modifying `harness.ts` to use the in-process client

4. **For CI/CD**: The current approach is fine. CI environments are ephemeral, so orphan processes die with the runner.

## Session Creation Cost

Session creation is lightweight (~1ms). From `opencode/session/index.ts`:

- Generate IDs (ULID)
- One SQLite INSERT
- Publish bus events

The heavy work is in the AI provider calls during `session.prompt()`.

## Concurrency

Sessions are independent — multiple can run concurrently. The bottleneck is provider rate limits, not opencode internals. Current default is 10 concurrent calls (`DEFAULT_CONCURRENCY` in `runner.ts`).
