// src/pages/Logs.tsx
import React, { useEffect, useState } from "react";
import {
  listSessionSummaries,
  listFullSessions,
  getFullSessionById,
  deleteSessionById,
  deleteAllSessions,
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

  async function handleDeleteSession(e: React.MouseEvent, id: string) {
    // prevent the row click event (openSummary) from firing
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this session?")) return;
    deleteSessionById(id);
    if (selected?.id === id) {
      setSelected(null);
      setSelectedFull(null);
    }
    refresh();
  }

  async function handleDeleteAll() {
    if (!window.confirm("Delete ALL saved sessions? This cannot be undone.")) return;
    try {
      deleteAllSessions();
    } catch (err) {
      console.warn(err);
    }
    setSelected(null);
    setSelectedFull(null);
    refresh();
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Sessions / Logs</h1>
        <div>
          <button
            onClick={handleDeleteAll}
            className="px-3 py-1 text-sm bg-red-600 text-white rounded"
          >
            Delete All
          </button>
        </div>
      </div>

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
                onClick={() => openSummary(s)}
                className={`p-3 rounded border cursor-pointer ${
                  selected?.id === s.id ? "bg-blue-50 border-blue-200" : "bg-white"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">
                      {s.exercise} ({s.mode})
                    </div>
                    <div className="text-xs text-gray-500">
                      {new Date(s.startTs).toLocaleString()}
                    </div>
                  </div>
                  <div className="text-sm text-gray-600">
                    {Math.round(s.durationMs / 1000)}s
                  </div>
                </div>
                <div className="flex justify-between items-center mt-2">
                  <div className="text-xs text-gray-500">{s.notes}</div>
                  <button
                    onClick={(e) => handleDeleteSession(e, s.id)}
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
                  Recorded at {new Date(selected.startTs).toLocaleString()}
                </div>
              </div>

              {selectedFull ? (
                <SessionGraph session={selectedFull} />
              ) : (
                <div className="bg-white p-4 rounded shadow">
                  <div className="text-sm text-gray-500">
                    Full session data not available for this entry. Make sure
                    SessionRecorder calls <code>saveFullSession(session)</code>.
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
