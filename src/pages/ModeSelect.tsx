// src/pages/ModeSelect.tsx
import React from "react";
import { Link } from "react-router-dom";

export default function ModeSelect() {
  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="max-w-2xl w-full">
        <h1 className="text-3xl font-bold mb-6">Choose a mode</h1>
        <div className="grid grid-cols-2 gap-4">
          <Link to="/library/exercise" className="p-6 bg-white rounded shadow text-center hover:shadow-lg">
            <div className="text-2xl font-semibold">Exercise</div>
            <div className="text-sm text-gray-500 mt-2">Strength, cardio - reps, counts and form.</div>
          </Link>

          <Link to="/library/yoga" className="p-6 bg-white rounded shadow text-center hover:shadow-lg">
            <div className="text-2xl font-semibold">Yoga</div>
            <div className="text-sm text-gray-500 mt-2">Poses, holds and breathing sessions.</div>
          </Link>
        </div>
      </div>
    </div>
  );
}
