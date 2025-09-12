import React from 'react';
import { Link } from 'react-router-dom';

const Dashboard: React.FC = () => {
  const dashboardCards = [
    {
      title: 'Fitness Detection',
      placeholder: '[ Fitness Detection Placeholder ]',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      route: '/fitness-detection',
    },
    {
      title: 'Posture Detection',
      placeholder: '[ Posture Camera Feed Placeholder ]',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
      route: '/posture-detection',
    },
    {
      title: 'Emotion Tracking',
      placeholder: '[ Emotion Detection Placeholder ]',
      bgColor: 'bg-purple-50',
      borderColor: 'border-purple-200',
      route: '/emotion-detection',
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-2">Monitor your fitness, posture, and emotions in real-time</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {dashboardCards.map((card, index) => (
            <div
              key={index}
              className={`${card.bgColor} ${card.borderColor} border-2 rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow duration-300`}
            >
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                {card.title}
              </h2>
              <div className="bg-white rounded-lg p-8 min-h-[200px] flex items-center justify-center border-2 border-dashed border-gray-300">
                <p className="text-gray-500 font-medium text-center">
                  {card.placeholder}
                </p>
              </div>
              <div className="mt-4 text-center">
                <Link
                  to={card.route}
                  className="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transform hover:scale-105 transition-all duration-200 shadow-md hover:shadow-lg"
                >
                  Start
                  <svg className="ml-2 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;