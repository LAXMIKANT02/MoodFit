import React from 'react';

const Logs: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Logs</h1>
          <p className="text-gray-600 mt-2">View your activity history and progress over time</p>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-12 text-center">
          <div className="max-w-md mx-auto">
            <div className="text-6xl text-gray-300 mb-4">📊</div>
            <p className="text-lg text-gray-500 font-medium">
              [ User activity and progress will appear here ]
            </p>
            <p className="text-sm text-gray-400 mt-2">
              Your fitness sessions, posture alerts, and mood tracking data will be displayed in this section.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Logs;