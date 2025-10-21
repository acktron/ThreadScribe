import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { motion } from 'framer-motion';
import LandingPage from './components/LandingPage';
import UploadPage from './components/UploadPage';
import DashboardPage from './components/DashboardPage';
import WhatsAppLivePage from './components/WhatsAppLivePage';
import ResultsPage from './components/ResultsPage';
import './index.css';

function App() {
  return (
    <Router>
      <div className="min-h-screen gradient-bg">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/upload" element={<UploadPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/whatsapp-live" element={<WhatsAppLivePage />} />
            <Route path="/results" element={<ResultsPage />} />
          </Routes>
        </motion.div>
      </div>
    </Router>
  );
}

export default App;