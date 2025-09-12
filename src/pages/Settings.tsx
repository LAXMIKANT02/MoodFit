import React from 'react';

const Settings: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-600 mt-2">Customize your experience and preferences</p>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-12 text-center">
          <div className="max-w-md mx-auto">
            <div className="text-6xl text-gray-300 mb-4">⚙️</div>
            <p className="text-lg text-gray-500 font-medium">
              [ Customize alerts, modes, and preferences here ]
            </p>
            <p className="text-sm text-gray-400 mt-2">
              Configure notification settings, detection sensitivity, and personalization options.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;