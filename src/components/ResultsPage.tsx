import React from "react";
import { useLocation } from "react-router-dom";
import { jsPDF } from "jspdf";

const ResultPage = () => {
  const location = useLocation();
  const summary = location.state?.summary || "";

  const fullSummaryText = summary;

  const handleCopy = () => {
    navigator.clipboard.writeText(fullSummaryText)
      .then(() => alert("Copied to clipboard!"))
      .catch(() => alert("Failed to copy."));
  };

  const handleDownloadPDF = () => {
    const doc = new jsPDF();
    const lines = doc.splitTextToSize(fullSummaryText, 180);
    doc.text(lines, 10, 10);
    doc.save("chat-summary.pdf");
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

    <div className="max-w-4xl mx-auto bg-white p-6 rounded-xl shadow-md border border-gray-200">
      <h2 className="text-lg font-semibold mb-2">Summary</h2>
      <p className="text-gray-800 whitespace-pre-wrap">{summary}</p>
    </div>
  </div>
);
}
export default ResultPage;
