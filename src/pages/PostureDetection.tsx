import React from 'react';
import { Link } from 'react-router-dom';

const PostureDetection: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <Link 
            to="/dashboard" 
            className="inline-flex items-center text-blue-600 hover:text-blue-800 mb-4 transition-colors"
          >
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Posture Detection</h1>
          <p className="text-gray-600 mt-2">Real-time posture monitoring and correction alerts</p>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="text-center">
            <div className="text-6xl mb-6">🪑</div>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              Posture Monitoring Active
            </h2>
            <div className="bg-green-50 border-2 border-green-200 rounded-lg p-12 min-h-[400px] flex items-center justify-center border-dashed">
              <div className="text-center">
                <p className="text-lg text-green-600 font-medium mb-2">
                  [ Posture Detection Camera Feed ]
                </p>
                <p className="text-sm text-gray-500">
                  AI will monitor your sitting posture and alert you when corrections are needed
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-center space-x-4">
              <button className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium">
                Start Monitoring
              </button>
              <button className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium">
                Stop Detection
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PostureDetection; 