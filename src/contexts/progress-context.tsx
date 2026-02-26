import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  createEmptyPowers,
  getDisplayPower,
  getGlobalDisplayPower,
  getRuleSlotIndex,
  getSectionDisplayPower,
  recordAnswerInPlace,
} from "~/lib/user-record";
import { PROGRESS } from "~/lib/constants";

interface ProgressContextValue {
  isLoggedIn: boolean;
  isLoading: boolean;
  userId: string | null;
  recordAnswer(ruleId: string, correct: boolean): void;
  getRulePower(ruleId: string): number;
  isRuleAttempted(ruleId: string): boolean;
  getSectionPower(sectionId: string): number;
  getGlobalPower(): number;
  flush(): Promise<void>;
  login(): Promise<void>;
  logout(): Promise<void>;
}

interface PendingAnswer {
  ruleId: string;
  correct: boolean;
}

interface ProgressApiResponse {
  powers: number[];
}

interface SessionResponse {
  isLoggedIn: boolean;
  userId?: string;
}

const ProgressContext = createContext<ProgressContextValue | null>(null);

export function ProgressProvider({ children }: { children: React.ReactNode }) {
  const [powers, setPowers] = useState<Uint16Array>(createEmptyPowers);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  const pendingAnswers = useRef<PendingAnswer[]>([]);
  const isLoggedInRef = useRef(false);

  // Keep ref in sync for beforeunload handler
  useEffect(() => {
    isLoggedInRef.current = isLoggedIn;
  }, [isLoggedIn]);

  const flush = useCallback(async (): Promise<void> => {
    if (!isLoggedIn || pendingAnswers.current.length === 0) return;
    const batch = pendingAnswers.current.splice(0);
    try {
      await fetch("/api/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: batch }),
      });
    } catch {
      // Re-queue on failure
      pendingAnswers.current.unshift(...batch);
    }
  }, [isLoggedIn]);

  // Auto-flush every 30 seconds
  useEffect(() => {
    const id = setInterval(() => {
      if (pendingAnswers.current.length > 0) {
        void flush();
      }
    }, PROGRESS.FLUSH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [flush]);

  // Best-effort flush on page unload via sendBeacon
  useEffect(() => {
    const handleUnload = () => {
      if (!isLoggedInRef.current || pendingAnswers.current.length === 0) return;
      const batch = pendingAnswers.current.splice(0);
      const blob = new Blob([JSON.stringify({ answers: batch })], {
        type: "application/json",
      });
      navigator.sendBeacon("/api/progress", blob);
    };
    window.addEventListener("beforeunload", handleUnload);
    return () => window.removeEventListener("beforeunload", handleUnload);
  }, []);

  // On mount: check session and load progress
  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      try {
        const sr = await fetch("/api/session");
        const sd = (await sr.json()) as SessionResponse;
        if (sd.isLoggedIn && sd.userId) {
          setIsLoggedIn(true);
          setUserId(sd.userId);
          const pr = await fetch("/api/progress");
          if (pr.status === 200) {
            const pd = (await pr.json()) as ProgressApiResponse;
            setPowers(new Uint16Array(pd.powers));
          } else {
            setPowers(createEmptyPowers());
          }
        }
      } catch {
        // Silently ignore network errors on mount
      } finally {
        setIsLoading(false);
      }
    };
    void init();
  }, []);

  const recordAnswer = useCallback(
    (ruleId: string, correct: boolean) => {
      if (!isLoggedIn) return;
      setPowers((prev) => {
        const next = new Uint16Array(prev);
        recordAnswerInPlace(next, ruleId, correct);
        return next;
      });
      pendingAnswers.current.push({ ruleId, correct });
    },
    [isLoggedIn],
  );

  const getRulePower = useCallback(
    (ruleId: string): number => {
      const idx = getRuleSlotIndex(ruleId);
      if (idx < 0) return 0;
      return getDisplayPower(powers[idx] ?? 0);
    },
    [powers],
  );

  const isRuleAttempted = useCallback(
    (ruleId: string): boolean => {
      const idx = getRuleSlotIndex(ruleId);
      if (idx < 0) return false;
      return (powers[idx] ?? 0) !== 0;
    },
    [powers],
  );

  const getSectionPower = useCallback(
    (sectionId: string): number => {
      return getSectionDisplayPower(powers, sectionId);
    },
    [powers],
  );

  const getGlobalPower = useCallback((): number => {
    return getGlobalDisplayPower(powers);
  }, [powers]);

  const login = useCallback(async (): Promise<void> => {
    const r = await fetch("/api/auth/dev-login", { method: "POST" });
    if (!r.ok) return;
    const data = (await r.json()) as { ok: boolean; userId: string };
    if (!data.ok) return;
    setIsLoggedIn(true);
    setUserId(data.userId);
    const pr = await fetch("/api/progress");
    if (pr.status === 200) {
      const pd = (await pr.json()) as ProgressApiResponse;
      setPowers(new Uint16Array(pd.powers));
    } else {
      setPowers(createEmptyPowers());
    }
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    await fetch("/api/auth/dev-logout", { method: "POST" });
    setIsLoggedIn(false);
    setUserId(null);
    setPowers(createEmptyPowers());
    pendingAnswers.current = [];
  }, []);

  const value: ProgressContextValue = {
    isLoggedIn,
    isLoading,
    userId,
    recordAnswer,
    getRulePower,
    isRuleAttempted,
    getSectionPower,
    getGlobalPower,
    flush,
    login,
    logout,
  };

  return (
    <ProgressContext.Provider value={value}>
      {children}
    </ProgressContext.Provider>
  );
}

export function useProgress(): ProgressContextValue {
  const ctx = useContext(ProgressContext);
  if (!ctx) {
    throw new Error("useProgress must be used within a ProgressProvider");
  }
  return ctx;
}
