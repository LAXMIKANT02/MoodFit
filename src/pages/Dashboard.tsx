import React, { useState } from "react";
import { Dumbbell, Smile, Accessibility, ArrowLeft } from "lucide-react";
import FitnessDetection from "./FitnessDetection";
import PostureDetection from "./PostureDetection";
import EmotionDetection from "./EmotionDetection";

const Dashboard: React.FC = () => {
  const [activeFeature, setActiveFeature] = useState<string | null>(null);

  const features = [
    {
      id: "fitness",
      title: "Fitness Detection",
      description: "Track and analyze your workouts in real time.",
      icon: <Dumbbell size={32} className="text-blue-500" />,
      component: <FitnessDetection />,
    },
    {
      id: "posture",
      title: "Posture Detection",
      description: "Check and correct your posture during exercises.",
      icon: <Accessibility size={32} className="text-green-500" />,
      component: <PostureDetection />,
    },
    {
      id: "emotion",
      title: "Emotion Detection",
      description: "Monitor your mood and emotional well-being.",
      icon: <Smile size={32} className="text-yellow-500" />,
      component: <EmotionDetection />,
    },
  ];

  if (activeFeature) {
    const feature = features.find((f) => f.id === activeFeature);
    return (
      <div className="max-w-4xl mx-auto px-4 py-10">
        <button
          onClick={() => setActiveFeature(null)}
          className="flex items-center space-x-2 mb-6 text-blue-500 hover:text-blue-700"
        >
          <ArrowLeft size={20} />
          <span>Back to Dashboard</span>
        </button>
        <h2 className="text-2xl font-bold text-black mb-4">{feature?.title}</h2>
        <div className="bg-gray-200 p-6 rounded-2xl shadow-lg">
          {feature?.component}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-10 grid grid-cols-1 md:grid-cols-3 gap-6">
      {features.map((feature) => (
        <div
          key={feature.id}
          className="bg-gray-200 rounded-2xl shadow-lg p-6 flex flex-col items-center text-center hover:scale-105 transition-transform"
        >
          {feature.icon}
          <h2 className="mt-4 text-xl font-bold text-black">{feature.title}</h2>
          <p className="mt-2 text-gray-800">{feature.description}</p>
          <button
            onClick={() => setActiveFeature(feature.id)}
            className="mt-4 px-4 py-2 bg-yellow-400 hover:bg-yellow-500 text-dark rounded-lg transition-colors"
          >
            Start
          </button>
        </div>
      ))}
    </div>
  );
};

export default Dashboard;
