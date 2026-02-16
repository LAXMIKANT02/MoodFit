// src/components/GraphsDashboard.tsx
import React, { useState } from "react";
import SessionGraph from "./SessionGraph";
import { listFullSessions, FullSession } from "../utils/sessionStorage";

export default function GraphsDashboard() {
  const sessions = listFullSessions() as FullSession[]; // your util
  const [selIdx, setSelIdx] = useState(0);

  if (!sessions || sessions.length === 0) return <div className="p-6 bg-white rounded shadow">No sessions available.</div>;

  const sel = sessions[selIdx];

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {sessions.map((s, i) => (
          <button key={i} onClick={() => setSelIdx(i)} className={`px-3 py-1 rounded ${i===selIdx ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}>
            {s.exercise || `Session ${i+1}`} ({Math.round(s.durationMs/1000)}s)
          </button>
        ))}
      </div>

      <SessionGraph session={sel} />
    </div>
  );
}
