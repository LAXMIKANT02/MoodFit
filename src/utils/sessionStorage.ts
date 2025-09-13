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
   Helpers
   ---------------------- */
function safeParse(raw: string | null) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (err) {
    console.warn("sessionStorage: JSON parse failed", err);
    return null;
  }
}

function normalizeSummary(s: any): SessionSummary {
  const startTs = Number(s?.startTs) || Date.now();
  const durationMs = Number(s?.durationMs) || 0;
  const endTs = Number(s?.endTs) || startTs + durationMs;
  return {
    id: String(s?.id || `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`),
    mode: s?.mode === "yoga" ? "yoga" : "exercise",
    exercise: String(s?.exercise || "unknown"),
    startTs,
    endTs,
    durationMs,
    reps: typeof s?.reps === "number" ? s.reps : undefined,
    notes: typeof s?.notes === "string" ? s.notes : undefined,
    videoUrl: typeof s?.videoUrl === "string" ? s.videoUrl : undefined,
    meta: s?.meta || {},
  };
}

function normalizeFullSession(fs: any): FullSession {
  const startTs = Number(fs?.startTs) || Date.now();
  const durationMs = Number(fs?.durationMs) || 0;
  const endTs = Number(fs?.endTs) || startTs + durationMs;
  const frames = Array.isArray(fs?.frames) ? fs.frames : [];
  return {
    id: String(fs?.id || `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`),
    mode: fs?.mode === "yoga" ? "yoga" : "exercise",
    exercise: String(fs?.exercise || "unknown"),
    startTs,
    endTs,
    durationMs,
    frames,
    meta: fs?.meta || {},
  };
}

/* ----------------------
   Summaries (lightweight)
   ---------------------- */
export function saveSessionSummary(summary: SessionSummary) {
  const raw = localStorage.getItem(SUMMARY_KEY);
  const arr: any[] = raw ? safeParse(raw) || [] : [];
  const normalized = normalizeSummary(summary);
  arr.unshift(normalized);
  try {
    localStorage.setItem(SUMMARY_KEY, JSON.stringify(arr));
  } catch (err) {
    console.warn("saveSessionSummary failed to write localStorage", err);
  }
}

export function listSessionSummaries(): SessionSummary[] {
  const raw = localStorage.getItem(SUMMARY_KEY);
  const arr: any[] = raw ? safeParse(raw) || [] : [];
  return arr.map(normalizeSummary);
}

export function deleteSessionById(id: string) {
  const raw = localStorage.getItem(SUMMARY_KEY);
  if (!raw) return;
  const arr: any[] = safeParse(raw) || [];
  const filtered = arr.filter((s) => String(s?.id) !== String(id));
  try {
    localStorage.setItem(SUMMARY_KEY, JSON.stringify(filtered));
  } catch (err) {
    console.warn("deleteSessionById failed", err);
  }
}

export function clearSummaries() {
  localStorage.removeItem(SUMMARY_KEY);
}

/* -------------------------
   Full sessions (heavy data)
   ------------------------- */
export function saveFullSession(session: FullSession) {
  const raw = localStorage.getItem(FULL_KEY);
  const arr: any[] = raw ? safeParse(raw) || [] : [];
  const normalized = normalizeFullSession(session);
  arr.unshift(normalized);
  try {
    localStorage.setItem(FULL_KEY, JSON.stringify(arr));
  } catch (err) {
    console.warn("saveFullSession failed to write localStorage", err);
  }
}

export function listFullSessions(): FullSession[] {
  const raw = localStorage.getItem(FULL_KEY);
  const arr: any[] = raw ? safeParse(raw) || [] : [];
  return arr.map(normalizeFullSession);
}

export function getFullSessionById(id: string): FullSession | undefined {
  const arr = listFullSessions();
  return arr.find((s) => String(s.id) === String(id));
}

export function deleteFullSessionById(id: string) {
  const raw = localStorage.getItem(FULL_KEY);
  if (!raw) return;
  const arr: any[] = safeParse(raw) || [];
  const filtered = arr.filter((s) => String(s?.id) !== String(id));
  try {
    localStorage.setItem(FULL_KEY, JSON.stringify(filtered));
  } catch (err) {
    console.warn("deleteFullSessionById failed", err);
  }
}

export function clearFullSessions() {
  localStorage.removeItem(FULL_KEY);
}
