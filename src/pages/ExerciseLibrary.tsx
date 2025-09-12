// src/pages/ExerciseLibrary.tsx
import React from "react";
import { Link, useParams, useNavigate } from "react-router-dom";

type Item = {
  id: string;
  title: string;
  description?: string;
  demoVideo?: string; // YouTube link or local file
};

const LIBRARY: Record<string, Item[]> = {
  exercise: [
    { id: "squat", title: "Squat", description: "Leg strength exercise", demoVideo: "https://www.youtube.com/watch?v=aclHkVaku9U" },
    { id: "pushup", title: "Push-up", description: "Upper body strength exercise", demoVideo: "https://www.youtube.com/watch?v=_l3ySVKYVJ8" },
    { id: "lunge", title: "Lunge", description: "Forward lunge for legs", demoVideo: "https://www.youtube.com/watch?v=QOVaHwm-Q6U" },
    { id: "plank", title: "Plank", description: "Core hold exercise", demoVideo: "https://www.youtube.com/watch?v=pSHjTRCQxIw" },
    { id: "jumping_jack", title: "Jumping Jack", description: "Cardio warm-up", demoVideo: "https://www.youtube.com/watch?v=c4DAnQ6DtF8" },
    { id: "situp", title: "Sit-up", description: "Abdominal strength exercise", demoVideo: "https://www.youtube.com/watch?v=1fbU_MkV7NE" },
    { id: "deadlift", title: "Deadlift", description: "Posterior chain exercise", demoVideo: "https://www.youtube.com/watch?v=op9kVnSso6Q" },
  ],
  yoga: [
    { id: "tree", title: "Tree Pose", description: "Single-leg balance", demoVideo: "https://www.youtube.com/watch?v=QwyolOnT3gA" },
    { id: "warrior2", title: "Warrior II Pose", description: "Standing yoga posture", demoVideo: "https://www.youtube.com/watch?v=Wo5mFksN9bI" },
  ],
};

export default function ExerciseLibrary() {
  const { mode } = useParams();
  const navigate = useNavigate();
  const items = LIBRARY[mode || "exercise"] || LIBRARY.exercise;

  const renderDemo = (demoVideo?: string) => {
    if (!demoVideo) {
      return <div className="w-full h-24 bg-gray-100 rounded flex items-center justify-center text-sm text-gray-500">No demo</div>;
    }
    if (demoVideo.startsWith("http")) {
      return (
        <iframe
          src={demoVideo.replace("watch?v=", "embed/")}
          title="Demo video"
          className="w-full h-24 rounded"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      );
    }
    return <video src={demoVideo} muted playsInline className="w-full h-24 object-cover rounded" />;
  };

  return (
    <div className="p-6">
      <Link to="/" className="text-blue-600 mb-4 inline-block">← Back</Link>
      <h1 className="text-2xl font-bold mb-4">{mode === "yoga" ? "Yoga Library" : "Exercise Library"}</h1>
      <div className="grid md:grid-cols-2 gap-4">
        {items.map(it => (
          <div key={it.id} className="bg-white p-4 rounded shadow">
            <div className="flex items-start space-x-4">
              <div className="w-1/3">{renderDemo(it.demoVideo)}</div>
              <div className="flex-1">
                <h2 className="font-semibold">{it.title}</h2>
                <p className="text-sm text-gray-600">{it.description}</p>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => navigate(`/session/${mode}/${it.id}`)}
                    className="px-3 py-1 bg-green-600 text-white rounded"
                  >
                    Start Session
                  </button>
                  {it.demoVideo && (
                    <a
                      href={it.demoVideo}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1 bg-gray-200 rounded"
                    >
                      Open Demo
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
