// import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import LandingPage from "./components/LandingPage";
import UploadPage from "./components/UploadPage";
import ResultPage from "./components/ResultsPage";
import LiveChatPage from "./components/LiveChatPage";
import WhatsAppWebPage from "./components/WhatsAppWebPage";

const App = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/upload" element={<UploadPage />} />
        <Route path="/results" element={<ResultPage />} />
        <Route path="/live-chat" element={<LiveChatPage />} />
        <Route path="/qr-chat" element={<WhatsAppWebPage />} />
      </Routes>
    </Router>
  );
};

export default App;