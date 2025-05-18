import React, { useState } from "react";
import FileUploader from "../components/FileUploader";
import LoadingSpinner from "../components/LoadingSpinner";

const UploadPage = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [chatText, setChatText] = useState("");

  const handleFileUpload = (text: string) => {
    setChatText(text);
  };

  const handleSubmit = async () => {
    if (!chatText.trim()) {
      alert("Please upload a file or paste chat text.");
      return;
    }

    setIsLoading(true);

    const delay = new Promise((resolve) => setTimeout(resolve, 5000));

    try {
      // Start fetch and delay concurrently
      const [response] = await Promise.all([
        fetch("/api/parse-and-summarize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: chatText }),
        }),
        delay,
      ]);

      const data = await response.json();
      console.log(data);

      setIsLoading(false);
    } catch (error) {
      console.error("Error uploading:", error);
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
          className="mt-6 w-full bg-teal-600 text-white py-3 rounded-md hover:bg-teal-700 transition"
        >
          {isLoading ? <LoadingSpinner /> : "Submit & Process"}
        </button>
      </div>
    </div>
  );
};

export default UploadPage;
