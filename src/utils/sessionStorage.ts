// src/utils/sessionStorage.ts
export type SessionSummary = {
  id: string;
  mode: "exercise" | "yoga";
  exercise: string;
  startTs: number;
  endTs: number;
  durationMs: number;
  reps?: number;
  notes?: string;
  videoUrl?: string; // temporary object URL (not persisted across reload in some browsers)
  meta?: Record<string, any>;
};

export type FullSession = {
  id: string;
  mode: "exercise" | "yoga";
  exercise: string;
  startTs: number;
  endTs: number;
  durationMs: number;
  frames: Array<{ t: number; landmarks: any[] }>;
  meta?: Record<string, any>;
};

const SUMMARY_KEY = "moodfit_sessions_summaries";
const FULL_KEY = "moodfit_sessions_full";

/* ----------------------
   Summaries (lightweight)
   ---------------------- */

export function saveSessionSummary(summary: SessionSummary) {
  const raw = localStorage.getItem(SUMMARY_KEY);
  const arr: SessionSummary[] = raw ? JSON.parse(raw) : [];
  arr.unshift(summary); // newest first
  localStorage.setItem(SUMMARY_KEY, JSON.stringify(arr));
}

export function listSessionSummaries(): SessionSummary[] {
  const raw = localStorage.getItem(SUMMARY_KEY);
  return raw ? JSON.parse(raw) : [];
}

export function clearSummaries() {
  localStorage.removeItem(SUMMARY_KEY);
}

/* -------------------------
   Full sessions (heavy data)
   ------------------------- */

export function saveFullSession(session: FullSession) {
  const raw = localStorage.getItem(FULL_KEY);
  const arr: FullSession[] = raw ? JSON.parse(raw) : [];
  // newest first
  arr.unshift(session);
  localStorage.setItem(FULL_KEY, JSON.stringify(arr));
}

export function listFullSessions(): FullSession[] {
  const raw = localStorage.getItem(FULL_KEY);
  return raw ? JSON.parse(raw) : [];
}

export function getFullSessionById(id: string): FullSession | undefined {
  const arr = listFullSessions();
  return arr.find((s) => s.id === id);
}

export function clearFullSessions() {
  localStorage.removeItem(FULL_KEY);
}

/* -------------------------
   Deletion helpers
   ------------------------- */

/**
 * Delete session by id from summaries and full sessions.
 * Use this to remove old recordings.
 */
export function deleteSessionById(id: string) {
  // delete from summaries
  try {
    const rawSumm = localStorage.getItem(SUMMARY_KEY);
    const arrSumm: SessionSummary[] = rawSumm ? JSON.parse(rawSumm) : [];
    const newSumm = arrSumm.filter((s) => s.id !== id);
    localStorage.setItem(SUMMARY_KEY, JSON.stringify(newSumm));
  } catch (err) {
    console.warn("deleteSessionById: could not update summaries", err);
  }

  // delete from full sessions
  try {
    const rawFull = localStorage.getItem(FULL_KEY);
    const arrFull: FullSession[] = rawFull ? JSON.parse(rawFull) : [];
    const newFull = arrFull.filter((s) => s.id !== id);
    localStorage.setItem(FULL_KEY, JSON.stringify(newFull));
  } catch (err) {
    console.warn("deleteSessionById: could not update full sessions", err);
  }

  // notify other tabs via storage event (best-effort)
  try {
    localStorage.setItem("__moodfit_last_change", `${Date.now()}`); // tiny nudge
  } catch (_) {}
}

/**
 * Optional helper: delete everything (summaries + full)
 */
export function deleteAllSessions() {
  localStorage.removeItem(SUMMARY_KEY);
  localStorage.removeItem(FULL_KEY);
  try { localStorage.setItem("__moodfit_last_change", `${Date.now()}`); } catch (_) {}
}
