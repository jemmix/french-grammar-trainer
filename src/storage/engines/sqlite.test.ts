import { describe, it, expect, beforeEach } from "vitest";
import { sqliteStore } from "./sqlite";
import { modifyUserPowers, getStore, deserialize } from "../store";
import { recordAnswerInPlace, getDisplayPower } from "~/mastery/progress";

process.env.SQLITE_DB_PATH = ":memory:";

const g = global as { _fgtDb?: unknown };

beforeEach(() => {
  delete g._fgtDb;
});

describe("sqliteStore", () => {
  describe("get / put / delete", () => {
    it("returns null for non-existent user", () => {
      expect(sqliteStore.get("nobody")).toBeNull();
    });

    it("put then get round-trips binary data", () => {
      const data = new Uint8Array([1, 2, 3, 4, 5]);
      sqliteStore.put("u1", data);
      const result = sqliteStore.get("u1");
      expect(result).toEqual(data);
    });

    it("put overwrites existing data", () => {
      sqliteStore.put("u2", new Uint8Array([10]));
      sqliteStore.put("u2", new Uint8Array([20, 30]));
      const result = sqliteStore.get("u2");
      expect(result).toEqual(new Uint8Array([20, 30]));
    });

    it("delete removes data", () => {
      sqliteStore.put("u3", new Uint8Array([42]));
      sqliteStore.delete("u3");
      expect(sqliteStore.get("u3")).toBeNull();
    });
  });

  describe("modify", () => {
    it("creates data for new user (current is null)", async () => {
      const result = await sqliteStore.modify("m-new", async (current) => {
        expect(current).toBeNull();
        return new Uint8Array([99]);
      });
      expect(result).toEqual(new Uint8Array([99]));
      expect(sqliteStore.get("m-new")).toEqual(new Uint8Array([99]));
    });

    it("passes existing data to callback", async () => {
      sqliteStore.put("m-existing", new Uint8Array([7]));
      await sqliteStore.modify("m-existing", async (current) => {
        expect(current).toEqual(new Uint8Array([7]));
        return new Uint8Array([8]);
      });
      expect(sqliteStore.get("m-existing")).toEqual(new Uint8Array([8]));
    });

    it("cumulative modifications persist", async () => {
      for (let i = 0; i < 5; i++) {
        await sqliteStore.modify("m-counter", async (current) => {
          const n = current ? parseInt(new TextDecoder().decode(current)) : 0;
          return new TextEncoder().encode(String(n + 1));
        });
      }
      const stored = sqliteStore.get("m-counter");
      expect(stored && new TextDecoder().decode(stored)).toBe("5");
    });

    it("serializes concurrent modify calls — no lost updates", async () => {
      const userId = "m-concurrent";

      await Promise.all(
        Array.from({ length: 20 }, () =>
          sqliteStore.modify(userId, async (current) => {
            const n = current ? parseInt(new TextDecoder().decode(current)) : 0;
            return new TextEncoder().encode(String(n + 1));
          }),
        ),
      );

      const result = sqliteStore.get(userId);
      expect(result && new TextDecoder().decode(result)).toBe("20");
    });
  });
});

describe("modifyUserPowers", () => {
  it("creates empty powers for new user and records answer", async () => {
    await modifyUserPowers("mp-new", (powers) => {
      recordAnswerInPlace(powers, "01-01", true);
    });

    const store = await getStore();
    const raw = await store.get("mp-new");
    expect(raw).not.toBeNull();
    const { powers } = await deserialize(raw!);
    expect(getDisplayPower(powers[0]!)).toBeGreaterThan(0);
  });

  it("applies cumulative modifications across calls", async () => {
    await modifyUserPowers("mp-cumulative", (powers) => {
      recordAnswerInPlace(powers, "01-01", true);
    });

    const firstPower = await getDisplayPowerFor("mp-cumulative");

    await modifyUserPowers("mp-cumulative", (powers) => {
      recordAnswerInPlace(powers, "01-01", true);
    });

    const secondPower = await getDisplayPowerFor("mp-cumulative");
    expect(secondPower).toBeGreaterThan(firstPower);
  });

  it("serializes concurrent modifications — no lost updates", async () => {
    // Run 10 concurrent answers for one user, 10 sequential for another.
    // If serialization works correctly, both should have the same final power.
    await Promise.all(
      Array.from({ length: 10 }, () =>
        modifyUserPowers("mp-concurrent", (powers) => {
          recordAnswerInPlace(powers, "01-01", true);
        }),
      ),
    );

    for (let i = 0; i < 10; i++) {
      await modifyUserPowers("mp-sequential", (powers) => {
        recordAnswerInPlace(powers, "01-01", true);
      });
    }

    const concurrentPower = await getDisplayPowerFor("mp-concurrent");
    const sequentialPower = await getDisplayPowerFor("mp-sequential");
    expect(concurrentPower).toBeCloseTo(sequentialPower, 10);
  });
});

async function getDisplayPowerFor(userId: string): Promise<number> {
  const store = await getStore();
  const raw = await store.get(userId);
  if (!raw) return 0;
  const { powers } = await deserialize(raw);
  return getDisplayPower(powers[0] ?? 0);
}
