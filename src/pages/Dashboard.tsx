import React from 'react';

const Dashboard: React.FC = () => {
  const dashboardCards = [
    {
      title: 'Fitness Detection',
      placeholder: '[ Fitness Detection Placeholder ]',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
    },
    {
      title: 'Posture Detection',
      placeholder: '[ Posture Camera Feed Placeholder ]',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
    },
    {
      title: 'Emotion Tracking',
      placeholder: '[ Emotion Detection Placeholder ]',
      bgColor: 'bg-purple-50',
      borderColor: 'border-purple-200',
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
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;