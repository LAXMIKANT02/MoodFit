import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import Dashboard from './pages/Dashboard';
import Logs from './pages/Logs';
import Settings from './pages/Settings';
import FitnessDetection from './pages/FitnessDetection';
import PostureDetection from './pages/PostureDetection';
import EmotionDetection from './pages/EmotionDetection';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="logs" element={<Logs />} />
          <Route path="settings" element={<Settings />} />
          <Route path="fitness-detection" element={<FitnessDetection />} />
          <Route path="posture-detection" element={<PostureDetection />} />
          <Route path="emotion-detection" element={<EmotionDetection />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;