import React, { useMemo } from "react";
import { useLocation } from "react-router-dom";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";

const ResultPage = () => {
  const location = useLocation();
  const rawContent = (location.state && location.state.rawContent) || "";

  const handleCopy = () => {
    navigator.clipboard.writeText(rawContent).then(() => {
      alert("Copied to clipboard!");
    }).catch(() => {
      alert("Failed to copy.");
    });
  };

  const handleDownloadPDF = () => {
    const doc = new jsPDF();
    const lines = doc.splitTextToSize(rawContent, 180); // wrap text
    doc.text(lines, 10, 10);
    doc.save("chat-summary.pdf");
  };

  if (!rawContent) {
    return <div className="text-center py-20">No results to show.</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100 px-4 py-8">
      <h1 className="text-3xl font-bold text-center mb-6">📄 Raw Chat Content</h1>

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

      <div className="bg-white p-6 rounded-xl shadow-md max-w-4xl mx-auto whitespace-pre-wrap overflow-x-auto">
        {rawContent}
      </div>
    </div>
  );
};

export default ResultPage;
