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
  videoUrl?: string; // temporary object URL available after recording (not persisted across reload)
  meta?: Record<string, any>;
};

const KEY = "moodfit_sessions";

export function saveSessionSummary(summary: SessionSummary) {
  const raw = localStorage.getItem(KEY);
  const arr: SessionSummary[] = raw ? JSON.parse(raw) : [];
  arr.unshift(summary); // newest first
  localStorage.setItem(KEY, JSON.stringify(arr));
}

export function listSessionSummaries(): SessionSummary[] {
  const raw = localStorage.getItem(KEY);
  return raw ? JSON.parse(raw) : [];
}

export function clearSummaries() {
  localStorage.removeItem(KEY);
}
