import React from "react";

interface FileUploaderProps {
  onUpload: (text: string) => void;
}

const FileUploader: React.FC<FileUploaderProps> = ({ onUpload }) => {
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "text/plain") {
      alert("Only .txt files are allowed");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      onUpload(text);
    };
    reader.readAsText(file);
  };

  return (
    <div className="mb-4">
      <label className="block font-medium mb-2">Upload .txt file</label>
      <input
        type="file"
        accept=".txt"
        onChange={handleFileChange}
        className="w-full p-2 border border-gray-300 rounded-md"
      />
    </div>
  );
};

export default FileUploader;
