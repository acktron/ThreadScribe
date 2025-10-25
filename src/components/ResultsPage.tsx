import { useState } from "react";
import { useLocation } from "react-router-dom";
import { jsPDF } from "jspdf";
import LoadingSpinner from "../components/LoadingSpinner";

const ResultPage = () => {
  const location = useLocation();
  const summary = location.state?.summary || "";
  const chatData = location.state?.chatData || "";

  const [query, setQuery] = useState("");
  const [response, setResponse] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [queryError, setQueryError] = useState("");

  const fullSummaryText = summary;

  const handleCopy = () => {
    navigator.clipboard
      .writeText(fullSummaryText)
      .then(() => alert("Copied to clipboard!"))
      .catch(() => alert("Failed to copy."));
  };

  const handleDownloadPDF = () => {
    const doc = new jsPDF();
    const lines = doc.splitTextToSize(fullSummaryText, 180);
    doc.text(lines, 10, 10);
    doc.save("chat-summary.pdf");
  };

  const handleQuery = async () => {
    if (!query.trim()) {
      setQueryError("Please enter your question.");
      return;
    }

    setIsLoading(true);
    setQueryError("");
    setResponse("");

    try {
      const requestBody = {
        query: query,
        chat_data: chatData
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
      setIsLoading(false);
    }
  };

  if (!summary || summary.length === 0) {
    return <div className="text-center py-20">No summary to display.</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100 px-4 py-8">
      <h1 className="text-3xl font-bold text-center mb-6">🧠 Chat Summary</h1>

      <div className="flex justify-center gap-4 mb-6">
        <button
          onClick={handleCopy}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition"
        >
          Copy to Clipboard
        </button>
        <button
          onClick={handleDownloadPDF}
          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition"
        >
          Download as PDF
        </button>
      </div>

      <div className="max-w-4xl mx-auto bg-white p-6 rounded-xl shadow-md border border-gray-200 mb-8">
        <h2 className="text-lg font-semibold mb-2">Summary</h2>
        <p className="text-gray-800 whitespace-pre-wrap">{summary}</p>
      </div>

      <div className="max-w-4xl mx-auto bg-white p-6 rounded-xl shadow-md border border-gray-200">
        <label className="block font-medium mb-2">Ask a follow-up question:</label>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g., What tasks were assigned?"
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
            <p className="text-gray-800 whitespace-pre-wrap">{response}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ResultPage;
