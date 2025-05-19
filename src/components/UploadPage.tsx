import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import FileUploader from "../components/FileUploader";
import LoadingSpinner from "../components/LoadingSpinner";

const UploadPage = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [chatText, setChatText] = useState("");
  const navigate = useNavigate();

  const handleFileUpload = (text: string) => {
    setChatText(text);
  };

  const handleSubmit = async () => {
    if (!chatText.trim()) {
      alert("Please upload a file or paste chat text.");
      return;
    }

    setIsLoading(true);

    // Simulate fake processing
    setTimeout(() => {
      setIsLoading(false);
      // Navigate to results page with dummy data (if needed)
      navigate("/results");
    }, 1000);
  };


return (
  <div className="min-h-screen bg-gradient-to-br from-teal-100 via-white to-teal-100 px-6 py-12 flex items-center justify-center">
    <div className="max-w-3xl w-full bg-white p-8 rounded-2xl shadow-xl border border-teal-200">
      <h1 className="text-3xl font-extrabold text-teal-700 mb-8 text-center">
        Upload WhatsApp Chat
      </h1>

      <FileUploader onUpload={handleFileUpload} />

      <div className="mt-8">
        <label className="block text-lg font-semibold mb-3 text-gray-700">
          Or paste raw chat text:
        </label>
        <textarea
          value={chatText}
          onChange={(e) => setChatText(e.target.value)}
          placeholder="Paste your WhatsApp chat text here..."
          className="w-full p-5 border-2 border-teal-300 focus:border-teal-500 rounded-lg min-h-[180px] resize-y shadow-sm transition-colors duration-300 text-gray-800"
        />
      </div>

      <button
        onClick={handleSubmit}
        disabled={isLoading}
        className={`mt-10 w-full py-4 rounded-xl text-white font-semibold tracking-wide shadow-lg transition duration-300 ${
          isLoading
            ? "bg-teal-300 cursor-not-allowed"
            : "bg-teal-600 hover:bg-teal-700"
        }`}
      >
        {isLoading ? <LoadingSpinner /> : "Submit & Process"}
      </button>
    </div>
  </div>
);

};

export default UploadPage;
