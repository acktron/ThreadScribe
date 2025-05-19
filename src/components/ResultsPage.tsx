import React from "react";
import { useLocation } from "react-router-dom";
import ConversationBlock from "./ConversationBlock";
import jsPDF from "jspdf";

const ResultPage = () => {
  const location = useLocation();
  const parsedData = [
  {
    summary: "Discussed project milestones and delegated initial tasks.",
    tasks: ["Finalize logo design", "Create API contract"],
    decisions: ["Use Firebase for auth", "Weekly meetings on Monday"],
    questions: ["Who’s leading the frontend?", "Any backend deadlines?"],
  },
  {
    summary: "Talked about the event launch strategy.",
    tasks: ["Design banners", "Prepare social media post drafts"],
    decisions: ["Launch date: June 20", "Use Twitter & LinkedIn"],
    questions: ["Who's making the launch trailer?"],
  },
  {
    summary: "Reviewed budget and resource allocation for Q3.",
    tasks: ["Get quotes from suppliers", "Hire two interns"],
    decisions: ["Increase marketing budget by 15%", "Outsource graphic design"],
    questions: ["When to finalize contracts?", "Who will onboard interns?"],
  },
];

  // const { parsedData } = location.state || { parsedData: null };


  if (!parsedData || !Array.isArray(parsedData)) {
    return <div className="text-center py-20">No results to show.</div>;
  }

  const copyToClipboard = () => {
    const textToCopy = parsedData
      .map(
        (block, i) =>
          `Block ${i + 1}\nSummary: ${block.summary}\nTasks: ${block.tasks.join(
            ", "
          )}\nDecisions: ${block.decisions.join(", ")}\nQuestions: ${block.questions.join(", ")}\n\n`
      )
      .join("");

    navigator.clipboard.writeText(textToCopy).then(() => {
      alert("Copied to clipboard!");
    });
  };

  const exportToPDF = () => {
    const doc = new jsPDF();

    let y = 10;

    parsedData.forEach((block, index) => {
      doc.setFontSize(14);
      doc.text(`Block ${index + 1}`, 10, y);
      y += 8;

      doc.setFontSize(12);
      doc.text(`Summary: ${block.summary}`, 10, y);
      y += 8;

      doc.text(`Tasks: ${block.tasks.join(", ")}`, 10, y);
      y += 8;

      doc.text(`Decisions: ${block.decisions.join(", ")}`, 10, y);
      y += 8;

      doc.text(`Questions: ${block.questions.join(", ")}`, 10, y);
      y += 12;

      if (y > 270) {
        doc.addPage();
        y = 10;
      }
    });

    doc.save("ThreadScribe_Summary.pdf");
  };

  return (
    <div className="min-h-screen bg-gray-100 px-4 py-8">
      <h1 className="text-3xl font-bold text-center mb-8">🧠 Summary Dashboard</h1>

      <div className="max-w-4xl mx-auto mb-6 flex gap-4 justify-center">
        <button
          onClick={copyToClipboard}
          className="bg-teal-600 text-white px-4 py-2 rounded hover:bg-teal-700 transition"
        >
          Copy to Clipboard
        </button>
        <button
          onClick={exportToPDF}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition"
        >
          Export as PDF
        </button>
      </div>

      <div className="space-y-6 max-w-4xl mx-auto">
        {parsedData.map((block, index) => (
          <ConversationBlock
            key={index}
            blockTitle={`Block ${index + 1}`}
            summary={block.summary}
            checklist={block.tasks}
            decisions={block.decisions}
            questions={block.questions}
          />
        ))}
      </div>
    </div>
  );
};

export default ResultPage;
