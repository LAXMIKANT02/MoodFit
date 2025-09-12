// src/pages/ExerciseLibrary.tsx
import React, { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

type Item = {
  id: string;
  title: string;
  description?: string;
  demoVideo?: string; // YouTube link or local file
  difficulty?: "easy" | "medium" | "hard";
};

const LIBRARY: Record<string, Item[]> = {
  exercise: [
    { id: "squat", title: "Squat", description: "Leg strength exercise", demoVideo: "https://www.youtube.com/watch?v=aclHkVaku9U", difficulty: "medium" },
    { id: "pushup", title: "Push-up", description: "Upper body strength exercise", demoVideo: "https://www.youtube.com/watch?v=_l3ySVKYVJ8", difficulty: "medium" },
    { id: "lunge", title: "Lunge", description: "Forward lunge for legs", demoVideo: "https://www.youtube.com/watch?v=QOVaHwm-Q6U", difficulty: "medium" },
    { id: "plank", title: "Plank", description: "Core hold exercise", demoVideo: "https://www.youtube.com/watch?v=pSHjTRCQxIw", difficulty: "easy" },
    { id: "jumping_jack", title: "Jumping Jack", description: "Cardio warm-up", demoVideo: "https://www.youtube.com/watch?v=c4DAnQ6DtF8", difficulty: "easy" },
    { id: "situp", title: "Sit-up", description: "Abdominal exercise", demoVideo: "https://www.youtube.com/watch?v=1fbU_MkV7NE", difficulty: "medium" },
    { id: "deadlift", title: "Deadlift", description: "Hip hinge and posterior chain", demoVideo: "https://www.youtube.com/watch?v=op9kVnSso6Q", difficulty: "hard" },
  ],
  yoga: [
    { id: "tree", title: "Tree Pose", description: "Single-leg balance", demoVideo: "https://www.youtube.com/watch?v=yVE4XXFFO70", difficulty: "easy" },
    { id: "warrior2", title: "Warrior II", description: "Standing posture with arms extended", demoVideo: "https://www.youtube.com/watch?v=4Ejz7IgODlU", difficulty: "medium" },
    { id: "downward_dog", title: "Downward Dog", description: "Stretch & lengthen the body", demoVideo: "https://www.youtube.com/watch?v=j97SSGsnCAQ", difficulty: "easy" },
    { id: "child_pose", title: "Child's Pose", description: "Rest and relax", demoVideo: "https://www.youtube.com/watch?v=eqVMAPM00DM", difficulty: "easy" },
    { id: "cobra", title: "Cobra Pose", description: "Chest opener", demoVideo: "https://www.youtube.com/watch?v=jwoTJNgh8BY", difficulty: "easy" },
    { id: "bridge", title: "Bridge Pose", description: "Backbend & glute activation", demoVideo: "https://www.youtube.com/watch?v=NnbvPeAIhmA", difficulty: "medium" },
    { id: "seated_forward_fold", title: "Seated Forward Fold", description: "Hamstring stretch", demoVideo: "https://www.youtube.com/watch?v=3qHXmRDN-ig", difficulty: "easy" },
  ],
};

function renderDemo(demo?: string) {
  if (!demo) {
    return <div className="w-full h-24 bg-gray-100 rounded flex items-center justify-center text-sm text-gray-500">No demo</div>;
  }
  if (demo.startsWith("http")) {
    const src = demo.includes("watch?v=") ? demo.replace("watch?v=", "embed/") : demo.includes("youtu.be/") ? demo.replace("youtu.be/", "www.youtube.com/embed/") : demo;
    return (
      <iframe
        src={src}
        title="Demo video"
        className="w-full h-24 rounded"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    );
  }
  return <video src={demo} muted playsInline className="w-full h-24 object-cover rounded" />;
}

export default function ExerciseLibrary() {
  const params = useParams();
  const navigate = useNavigate();

  const initialMode = (params.mode as string) || "exercise";
  const [mode, setMode] = useState<string>(initialMode);
  const items = LIBRARY[mode] || [];

  // search + difficulty filter + music toggle map
  const [query, setQuery] = useState("");
  const [difficultyFilter, setDifficultyFilter] = useState<"" | "easy" | "medium" | "hard">("");
  // store per-item music choice in memory (not persisted)
  const [musicMap, setMusicMap] = useState<Record<string, boolean>>({});

  const filtered = items.filter(it => {
    const matchesQ = !query || `${it.title} ${it.description}`.toLowerCase().includes(query.toLowerCase());
    const matchesDiff = !difficultyFilter || it.difficulty === difficultyFilter;
    return matchesQ && matchesDiff;
  });

  function toggleMusic(id: string) {
    setMusicMap(m => ({ ...m, [id]: !m[id] }));
  }

  return (
    <div className="p-6">
      <Link to="/" className="text-blue-600 mb-4 inline-block">← Back</Link>

      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">{mode === "yoga" ? "Yoga Library" : "Exercise Library"}</h1>
          <p className="text-sm text-gray-600">Browse demos, search, and launch sessions (optionally with music).</p>
        </div>

        <div className="flex gap-2">
          <button onClick={() => { setMode("exercise"); navigate("/library/exercise"); }} className={`px-3 py-1 rounded ${mode === "exercise" ? "bg-blue-600 text-white" : "bg-gray-100"}`}>Exercise</button>
          <button onClick={() => { setMode("yoga"); navigate("/library/yoga"); }} className={`px-3 py-1 rounded ${mode === "yoga" ? "bg-blue-600 text-white" : "bg-gray-100"}`}>Yoga</button>
        </div>
      </div>

      <div className="mb-4 flex flex-col md:flex-row md:items-center md:gap-3">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search exercises or poses" className="px-3 py-2 border rounded w-full md:w-72 mb-2 md:mb-0" />
        <select value={difficultyFilter} onChange={(e) => setDifficultyFilter(e.target.value as any)} className="px-3 py-2 border rounded">
          <option value="">All difficulties</option>
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
        </select>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {filtered.map(it => (
          <div key={it.id} className="bg-white p-4 rounded shadow flex gap-4 items-start">
            <div className="w-1/3">{renderDemo(it.demoVideo)}</div>
            <div className="flex-1">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="font-semibold">{it.title}</h2>
                  <p className="text-sm text-gray-600">{it.description}</p>
                </div>
                <div className="text-xs text-gray-500">{it.difficulty?.toUpperCase()}</div>
              </div>

              <div className="mt-3 flex items-center gap-2">
                <button
                  onClick={() => navigate(`/session/${mode}/${it.id}${musicMap[it.id] ? "?music=true" : ""}`)}
                  className="px-3 py-1 bg-green-600 text-white rounded"
                >
                  Start Session
                </button>

                <a href={it.demoVideo} target="_blank" rel="noreferrer" className="px-3 py-1 bg-gray-200 rounded">Open Demo</a>

              </div>
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="col-span-2 p-6 bg-white rounded shadow text-gray-600">No items match your search/filter.</div>
        )}
      </div>
    </div>
  );
}
