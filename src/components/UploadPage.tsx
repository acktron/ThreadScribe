import { useState } from "react";
import { useNavigate } from "react-router-dom";
import FileUploader from "../components/FileUploader";
import LoadingSpinner from "../components/LoadingSpinner";

const UploadPage = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [chatText, setChatText] = useState("");
  const [query, setQuery] = useState("");
  const [response, setResponse] = useState("");
  const [isQueryLoading, setIsQueryLoading] = useState(false);
  const [queryError, setQueryError] = useState("");
  const [processedChatData, setProcessedChatData] = useState("");
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
        // Store processed chat data for queries
        setProcessedChatData(chatText);
        navigate("/results", { state: { summary: result.summary, chatData: chatText } });
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
      setQueryError("Please enter your question.");
      return;
    }

    if (!chatText.trim() && !processedChatData.trim()) {
      setQueryError("Please upload a chat file first before asking questions.");
      return;
    }

    setIsQueryLoading(true);
    setQueryError("");
    setResponse("");

    try {
      const requestBody = {
        query: query,
        chat_data: chatText || processedChatData
      };

      const res = await fetch("http://localhost:8000/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }

      const result = await res.json();
      if (result.answer) {
        setResponse(result.answer);
      } else {
        setQueryError("No answer received from the server.");
      }
    } catch (error) {
      console.error("Query error:", error);
      setQueryError("Failed to get response. Please try again.");
    } finally {
      setIsQueryLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-white flex flex-col items-center justify-center px-6 py-12">
      <h1 className="text-4xl font-bold mb-6 text-teal-600 drop-shadow-sm">
        Upload WhatsApp Chat
      </h1>

      <div className="w-full max-w-3xl bg-white p-8 rounded-2xl shadow-xl">
        <FileUploader onUpload={handleFileUpload} />

        <div className="mt-6">
          <label className="block text-lg font-medium mb-2 text-gray-700">
            Or paste raw chat text:
          </label>
          <textarea
            value={chatText}
            onChange={(e) => setChatText(e.target.value)}
            placeholder="Paste your WhatsApp chat text here..."
            className="w-full p-4 border border-gray-300 rounded-lg min-h-[180px] resize-y focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
          />
        </div>

        <button
          onClick={handleSubmit}
          disabled={isLoading}
          className={`mt-6 w-full py-3 rounded-lg text-white font-semibold transition ${
            isLoading
              ? "bg-teal-400 cursor-not-allowed"
              : "bg-teal-600 hover:bg-teal-700"
          }`}
        >
          {isLoading ? <LoadingSpinner /> : "Submit & Process"}
        </button>

        <hr className="my-8" />

        {/* Query Section */}
        <div className="mt-8 p-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200">
          <h3 className="text-xl font-semibold mb-4 text-gray-800 flex items-center">
            <span className="mr-2">🤖</span>
            Ask Questions About Your Chat
          </h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700">
                Enter your question:
              </label>
              <textarea
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="e.g., What were the key decisions made? Who mentioned important deadlines? What was the main topic discussed?"
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition resize-none"
                rows={3}
                disabled={isQueryLoading}
              />
            </div>

            {queryError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-600 text-sm">{queryError}</p>
              </div>
            )}

            <button
              onClick={handleQuery}
              disabled={isQueryLoading || !chatText.trim()}
              className={`w-full py-3 rounded-lg text-white font-semibold transition flex items-center justify-center ${
                isQueryLoading || !chatText.trim()
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-indigo-600 hover:bg-indigo-700"
              }`}
            >
              {isQueryLoading ? (
                <>
                  <LoadingSpinner />
                  <span className="ml-2">Processing...</span>
                </>
              ) : (
                "Ask Question"
              )}
            </button>

            {!chatText.trim() && (
              <p className="text-sm text-gray-500 text-center">
                Upload a chat file first to ask questions about it
              </p>
            )}
          </div>

          {response && (
            <div className="mt-6 bg-white p-4 border border-gray-200 rounded-lg shadow-sm">
              <div className="flex items-center mb-3">
                <span className="text-green-500 mr-2">✓</span>
                <h4 className="font-semibold text-gray-800">AI Response:</h4>
              </div>
              <div className="prose prose-sm max-w-none">
                <p className="text-gray-700 whitespace-pre-wrap">{response}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UploadPage;
