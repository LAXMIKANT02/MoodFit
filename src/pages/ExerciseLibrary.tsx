// src/pages/ExerciseLibrary.tsx
import React from "react";
import { Link, useParams, useNavigate } from "react-router-dom";

type Item = {
  id: string;
  title: string;
  description?: string;
  demoVideo?: string; // public/videos/... or external URL
};

const LIBRARY: Record<string, Item[]> = {
  exercise: [
    { id: "squat", title: "Squat", description: "Full-body squat demo", demoVideo: "/videos/exercise/squat_demo.mp4" },
    { id: "pushup", title: "Push-up", description: "Push-up demo", demoVideo: "/videos/exercise/pushup_demo.mp4" },
    { id: "lunge", title: "Lunge", description: "Forward lunge demo", demoVideo: "/videos/exercise/lunge_demo.mp4" },
  ],
  yoga: [
    { id: "tree", title: "Tree Pose", description: "Single-leg balancing pose", demoVideo: "/videos/yoga/tree_demo.mp4" },
    { id: "warrior2", title: "Warrior II", description: "Standing stance with arms extended", demoVideo: "/videos/yoga/warrior2_demo.mp4" },
  ],
};

export default function ExerciseLibrary() {
  const { mode } = useParams();
  const navigate = useNavigate();
  const items = LIBRARY[mode || "exercise"] || LIBRARY.exercise;

  return (
    <div className="p-6">
      <Link to="/" className="text-blue-600 mb-4 inline-block">← Back</Link>
      <h1 className="text-2xl font-bold mb-4">{mode === "yoga" ? "Yoga Library" : "Exercise Library"}</h1>
      <div className="grid md:grid-cols-2 gap-4">
        {items.map(it => (
          <div key={it.id} className="bg-white p-4 rounded shadow">
            <div className="flex items-start space-x-4">
              <div className="w-1/3">
                {/* demo thumbnail if local file exists, otherwise blank */}
                <video src={it.demoVideo} muted playsInline className="w-full h-24 object-cover rounded" />
              </div>
              <div className="flex-1">
                <h2 className="font-semibold">{it.title}</h2>
                <p className="text-sm text-gray-600">{it.description}</p>
                <div className="mt-3 flex gap-2">
                  <button onClick={() => navigate(`/session/${mode}/${it.id}`)} className="px-3 py-1 bg-green-600 text-white rounded">Start Session</button>
                  <a href={it.demoVideo} target="_blank" rel="noreferrer" className="px-3 py-1 bg-gray-200 rounded">Open Demo</a>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
