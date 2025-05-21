import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import FileUploader from "../components/FileUploader";
import LoadingSpinner from "../components/LoadingSpinner";

const UploadPage = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [chatText, setChatText] = useState("");
  const [query, setQuery] = useState("");
  const [response, setResponse] = useState("");
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

    try {
      const formData = new FormData();
      const blob = new Blob([chatText], { type: "text/plain" });
      formData.append("file", blob);

      const response = await fetch("http://localhost:8000/api/parse-and-summarize", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();
      console.log("API Response:", result);

      if (result.summary) {
        navigate("/results", { state: { summary: result.summary } });
      } else {
        alert("Invalid response from server.");
      }

    } catch (error) {
      console.error("Upload error:", error);
      alert("Failed to process chat. Try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuery = async () => {
    if (!query.trim()) {
      alert("Enter your query.");
      return;
    }

    setIsLoading(true);
    try {
      const formData = new FormData();
      formData.append("query", query);

      const response = await fetch("http://localhost:8000/api/chat", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();
      if (result.answer) {
        setResponse(result.answer);
      } else {
        alert("No answer returned.");
      }
    } catch (error) {
      console.error("Chat query error:", error);
      alert("Failed to get response.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 px-4 py-8">
      <div className="max-w-3xl mx-auto bg-white p-6 rounded-xl shadow-md">
        <h1 className="text-2xl font-bold mb-4">Upload WhatsApp Chat</h1>

        <FileUploader onUpload={handleFileUpload} />

        <div className="mt-6">
          <label className="block font-medium mb-2">Or paste raw chat text:</label>
          <textarea
            value={chatText}
            onChange={(e) => setChatText(e.target.value)}
            placeholder="Paste your WhatsApp chat text here..."
            className="w-full p-4 border border-gray-300 rounded-md min-h-[180px] resize-y"
          />
        </div>

        <button
          onClick={handleSubmit}
          disabled={isLoading}
          className={`mt-6 w-full py-3 rounded-md text-white transition ${
            isLoading ? "bg-gray-400 cursor-not-allowed" : "bg-teal-600 hover:bg-teal-700"
          }`}
        >
          {isLoading ? <LoadingSpinner /> : "Submit & Process"}
        </button>

        <hr className="my-6" />

        <div className="mt-4">
          <label className="block font-medium mb-2">Ask a follow-up question:</label>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g., What were the key decisions made?"
            className="w-full p-3 border border-gray-300 rounded-md"
          />

          <button
            onClick={handleQuery}
            disabled={isLoading}
            className={`mt-4 w-full py-3 rounded-md text-white transition ${
              isLoading ? "bg-gray-400 cursor-not-allowed" : "bg-indigo-600 hover:bg-indigo-700"
            }`}
          >
            {isLoading ? <LoadingSpinner /> : "Ask"}
          </button>

          {response && (
            <div className="mt-4 bg-gray-50 p-4 border border-gray-200 rounded-md">
              <h3 className="font-semibold mb-2">Response:</h3>
              <p>{response}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UploadPage;
