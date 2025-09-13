// src/pages/Logs.tsx
import React, { useEffect, useState } from "react";
import {
  listSessionSummaries,
  listFullSessions,
  getFullSessionById,
  deleteSessionById,
  SessionSummary,
  FullSession,
} from "../utils/sessionStorage";
import SessionGraph from "../components/SessionGraph";

export default function Logs() {
  const [summaries, setSummaries] = useState<SessionSummary[]>([]);
  const [fullSessions, setFullSessions] = useState<FullSession[]>([]);
  const [selected, setSelected] = useState<SessionSummary | null>(null);
  const [selectedFull, setSelectedFull] = useState<FullSession | null>(null);

  function refresh() {
    setSummaries(listSessionSummaries());
    setFullSessions(listFullSessions());
  }

  useEffect(() => {
    refresh();
    const onStorage = () => refresh();
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  function openSummary(s: SessionSummary) {
    setSelected(s);
    const fs = getFullSessionById(s.id);
    setSelectedFull(fs || null);
  }

  async function deleteSession(id: string) {
    if (!window.confirm("Are you sure you want to delete this session?")) return;
    deleteSessionById(id);
    // also attempt to delete full session entry if exists
    try {
      // import function exists in sessionStorage; we don't import deleteFullSessionById to keep simple
      const full = getFullSessionById(id);
      if (full) {
        // remove the matching full session by re-writing full sessions
        const updated = listFullSessions().filter((f) => f.id !== id);
        localStorage.setItem("moodfit_sessions_full", JSON.stringify(updated));
      }
    } catch (err) {
      // ignore
    }
    if (selected?.id === id) {
      setSelected(null);
      setSelectedFull(null);
    }
    refresh();
  }

  function formatDate(ts?: number) {
    if (!ts || Number.isNaN(Number(ts))) return "Unknown time";
    try {
      return new Date(Number(ts)).toLocaleString();
      // if you want a fixed timezone:  .toLocaleString(undefined, { timeZone: "Asia/Kolkata" })
    } catch {
      return "Unknown time";
    }
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Sessions / Logs</h1>
      <div className="grid md:grid-cols-3 gap-4">
        <div className="col-span-1">
          <h3 className="font-semibold mb-2">Recent sessions</h3>
          <div className="space-y-2">
            {summaries.length === 0 && (
              <div className="text-sm text-gray-500">No sessions recorded yet.</div>
            )}
            {summaries.map((s) => (
              <div
                key={s.id}
                className={`p-3 rounded border cursor-pointer ${
                  selected?.id === s.id ? "bg-blue-50 border-blue-200" : "bg-white"
                }`}
              >
                <div
                  className="flex items-center justify-between"
                  onClick={() => openSummary(s)}
                >
                  <div>
                    <div className="font-medium">
                      {s.exercise} ({s.mode})
                    </div>
                    <div className="text-xs text-gray-500">
                      {formatDate(s.startTs)}
                    </div>
                  </div>
                  <div className="text-sm text-gray-600">
                    {Math.round(s.durationMs / 1000)}s
                  </div>
                </div>
                <div className="flex justify-between items-center mt-2">
                  <div className="text-xs text-gray-500">{s.notes}</div>
                  <button
                    onClick={() => deleteSession(s.id)}
                    className="text-xs text-red-600 hover:underline"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="col-span-2">
          {selected ? (
            <>
              <div className="mb-3">
                <h2 className="text-xl font-semibold">
                  {selected.exercise} — {selected.mode}
                </h2>
                <div className="text-sm text-gray-500">
                  Recorded at {formatDate(selected.startTs)}
                </div>
              </div>

              {selectedFull ? (
                <SessionGraph session={selectedFull} />
              ) : (
                <div className="bg-white p-4 rounded shadow">
                  <div className="text-sm text-gray-500">
                    Full session data not available for this entry. Make sure
                    <code className="mx-1">SessionRecorder</code> calls{" "}
                    <code className="mx-1">saveFullSession(session)</code> when recording stops.
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="bg-white p-6 rounded shadow text-gray-500">
              Select a session on the left to view analytics.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
