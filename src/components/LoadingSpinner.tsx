import React from "react";

const LoadingSpinner: React.FC = () => {
  return (
    <div className="flex items-center justify-center space-x-2">
      <div className="w-5 h-5 border-4 border-teal-500 border-dashed rounded-full animate-spin"></div>
      <span className="text-white font-medium text-sm">Processing...</span>
    </div>
  );
};


export default LoadingSpinner;
