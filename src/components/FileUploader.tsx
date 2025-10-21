import React from "react";

interface FileUploaderProps {
  onUpload: (text: string) => void;
}

const FileUploader: React.FC<FileUploaderProps> = ({ onUpload }) => {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "text/plain") {
      alert("Only .txt files are allowed");
      e.target.value = ""; // reset input
      return;
    }

    const maxSizeMB = 5;
    if (file.size > maxSizeMB * 1024 * 1024) {
      alert(`File size must be less than ${maxSizeMB} MB`);
      e.target.value = ""; // reset input
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
