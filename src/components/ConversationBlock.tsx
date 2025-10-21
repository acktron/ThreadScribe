import React, { useState } from "react";

interface BlockProps {
  blockTitle: string;
  summary: string;
  checklist: string[];
  decisions: string[];
  questions: string[];
}

const ConversationBlock: React.FC<BlockProps> = ({
  blockTitle,
  summary,
  checklist,
  decisions,
  questions,
}) => {
  const [isOpen, setIsOpen] = useState(true); // Toggle state
  const [checkedItems, setCheckedItems] = useState<boolean[]>(
    checklist.map(() => false)
  );

  const toggleCheck = (index: number) => {
    const updated = [...checkedItems];
    updated[index] = !updated[index];
    setCheckedItems(updated);
  };

  return (
    <div className="bg-white rounded-xl shadow-md mb-6">
      {/* Header with toggle */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="cursor-pointer flex justify-between items-center px-6 py-4 border-b hover:bg-gray-50 transition"
      >
        <h2 className="text-xl font-bold text-teal-700">{blockTitle}</h2>
        <span className="text-gray-500 text-lg">
          {isOpen ? "−" : "+"}
        </span>
      </div>

      {/* Body */}
      {isOpen && (
        <div className="p-6">
          <h3 className="text-lg font-semibold mb-2">📝 Summary</h3>
          <p className="mb-4 text-gray-700">{summary}</p>

          <h3 className="font-medium mb-2">✅ Task List</h3>
          <ul className="mb-4 space-y-2">
            {checklist.map((task, idx) => (
              <li key={idx} className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={checkedItems[idx]}
                  onChange={() => toggleCheck(idx)}
                  className="w-5 h-5 text-teal-600 rounded"
                />
                <span
                  className={`${
                    checkedItems[idx] ? "line-through text-gray-400" : ""
                  }`}
                >
                  {task}
                </span>
              </li>
            ))}
          </ul>

          <h3 className="font-medium mb-2">📌 Decisions</h3>
          <ul className="mb-4 list-disc list-inside text-gray-700">
            {decisions.map((d, idx) => (
              <li key={idx}>{d}</li>
            ))}
          </ul>

          <h3 className="font-medium mb-2">❓ Questions</h3>
          <ul className="list-disc list-inside text-gray-700">
            {questions.map((q, idx) => (
              <li key={idx}>{q}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default ConversationBlock;
