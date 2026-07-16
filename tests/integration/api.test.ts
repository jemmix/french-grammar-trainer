import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawn, type ChildProcess } from "node:child_process";

const PORT = 3999;
const BASE = `http://localhost:${PORT}`;
const STARTUP_TIMEOUT = 90_000;

let server: ChildProcess | null = null;

async function waitForServer(): Promise<void> {
  const deadline = Date.now() + STARTUP_TIMEOUT;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE}/api/session`);
      if (res.status === 200) return;
    } catch {
      // Server not ready yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Server didn't respond within ${STARTUP_TIMEOUT}ms`);
}

function extractCookie(res: Response): string {
  const raw = res.headers.get("set-cookie");
  if (!raw) throw new Error("Expected Set-Cookie header");
  return raw.split(";")[0]!;
}

beforeAll(async () => {
  server = spawn("npx", ["next", "dev", "-p", String(PORT)], {
    env: {
      ...process.env,
      NODE_ENV: "development",
      COOKIE_SECRET: "test-cookie-secret-not-for-production-0123456789",
      HMAC_KEY: "test-hmac-key-not-for-prod",
      STORAGE_ENGINE: "sqlite",
      AUTH_ENGINE: "dev",
      SQLITE_DB_PATH: ":memory:",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  server.stderr?.on("data", (d) => process.stderr.write(d));
  await waitForServer();
}, STARTUP_TIMEOUT + 10_000);

afterAll(() => {
  server?.kill("SIGTERM");
});

describe("anonymous API access", () => {
  it("GET /api/session → isLoggedIn: false", async () => {
    const res = await fetch(`${BASE}/api/session`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ isLoggedIn: false });
  });

  it("GET /api/progress without session → 401", async () => {
    const res = await fetch(`${BASE}/api/progress`);
    expect(res.status).toBe(401);
  });

  it("POST /api/progress without session → 401", async () => {
    const res = await fetch(`${BASE}/api/progress`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers: [] }),
    });
    expect(res.status).toBe(401);
  });
});

describe("dev auth", () => {
  it("POST /api/auth/dev-login → creates session", async () => {
    const res = await fetch(`${BASE}/api/auth/dev-login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.userId).toMatch(/^[0-9a-f]+$/);
    expect(res.headers.get("set-cookie")).toContain("fgt-session=");
  });

  it("POST /api/auth/dev-login with sub:1 → denied", async () => {
    const res = await fetch(`${BASE}/api/auth/dev-login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sub: "1" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.denied).toBe(true);
    expect(res.headers.get("set-cookie")).toBeNull();
  });
});

describe("authenticated flow", () => {
  let cookie: string;

  beforeAll(async () => {
    const res = await fetch(`${BASE}/api/auth/dev-login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    cookie = extractCookie(res);
  });

  it("GET /api/session with cookie → isLoggedIn: true", async () => {
    const res = await fetch(`${BASE}/api/session`, {
      headers: { Cookie: cookie },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.isLoggedIn).toBe(true);
    expect(body.userId).toMatch(/^[0-9a-f]+$/);
  });

  it("GET /api/progress — new user → 204", async () => {
    const res = await fetch(`${BASE}/api/progress`, {
      headers: { Cookie: cookie },
    });
    expect(res.status).toBe(204);
  });

  it("POST /api/progress — submit answers", async () => {
    const res = await fetch(`${BASE}/api/progress`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({
        answers: [
          { ruleId: "01-01", correct: true },
          { ruleId: "01-02", correct: false },
        ],
      }),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("GET /api/progress — after answers → powers updated", async () => {
    const res = await fetch(`${BASE}/api/progress`, {
      headers: { Cookie: cookie },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.powers).toBeInstanceOf(Array);
    expect(body.powers.length).toBeGreaterThan(0);
    expect(body.powers[0]).toBeGreaterThan(0);
  });

  it("POST /api/progress — invalid body → 400", async () => {
    const res = await fetch(`${BASE}/api/progress`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ notAnswers: true }),
    });
    expect(res.status).toBe(400);
  });

  it("DELETE /api/progress → 200", async () => {
    const res = await fetch(`${BASE}/api/progress`, {
      method: "DELETE",
      headers: { Cookie: cookie },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("GET /api/progress — after delete → 204", async () => {
    const res = await fetch(`${BASE}/api/progress`, {
      headers: { Cookie: cookie },
    });
    expect(res.status).toBe(204);
  });

  it("POST /api/auth/dev-logout → expires session cookie", async () => {
    const res = await fetch(`${BASE}/api/auth/dev-logout`, {
      method: "POST",
      headers: { Cookie: cookie },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    const setCookie = res.headers.get("set-cookie");
    expect(setCookie).toBeTruthy();
    expect(setCookie).toMatch(/expires=/i);
  });
});
