import React, { useMemo } from "react";
import { useLocation } from "react-router-dom";
import ConversationBlock from "./ConversationBlock";

const ResultPage = () => {
  const location = useLocation();
  const rawContent = (location.state && location.state.rawContent) || "";

  const parsedData = useMemo(() => {
    if (!rawContent) return [];

    const blocks = rawContent.split(/\n\s*\n/);

    return blocks.map((blockText: string, i: any) => ({
      summary: blockText.slice(0, 100) + (blockText.length > 100 ? "..." : ""),
      tasks: ["Task 1 example", "Task 2 example"],
      decisions: ["Decision 1 example", "Decision 2 example"],
      questions: ["Question 1 example?", "Question 2 example?"],
    }));
  }, [rawContent]);

  if (!rawContent) {
    return <div className="text-center py-20">No results to show.</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100 px-4 py-8">
      <h1 className="text-3xl font-bold text-center mb-8">🧠 Summary Dashboard</h1>

      <div className="space-y-6 max-w-4xl mx-auto">
        {parsedData.map((block: { summary: string; tasks: string[]; decisions: string[]; questions: string[]; }, index: number) => (
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
