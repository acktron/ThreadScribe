import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Upload, FileText, MessageSquare, ArrowLeft, Loader2 } from 'lucide-react';
import axios from 'axios';

const UploadPage = () => {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [chatText, setChatText] = useState("");
  const [query, setQuery] = useState("");
  const [response, setResponse] = useState("");
  const [isQueryLoading, setIsQueryLoading] = useState(false);
  const [queryError, setQueryError] = useState("");

  // Update page title
  useEffect(() => {
    document.title = "Upload Chat - ThreadScribe";
  }, []);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleFileRead = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        setChatText(content);
        resolve(content);
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  };

  const handleUpload = async () => {
    if (!file) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await axios.post('http://localhost:8000/api/parse-and-summarize', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      // Read file content for queries and wait for it to complete
      const fileContent = await handleFileRead(file);

      // Navigate to results page with the processed data
      navigate('/results', { 
        state: { 
          processedChat: response.data,
          fileName: file.name,
          chatData: fileContent
        } 
      });
    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to process the chat file. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleQuery = async () => {
    if (!query.trim()) {
      setQueryError("Please enter your question.");
      return;
    }

    if (!chatText.trim()) {
      setQueryError("Please upload a chat file first before asking questions.");
      return;
    }

    setIsQueryLoading(true);
    setQueryError("");
    setResponse("");

    try {
      const requestBody = {
        query: query,
        chat_data: chatText
      };

      const res = await axios.post("http://localhost:8000/api/chat", requestBody, {
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (res.data.answer) {
        setResponse(res.data.answer);
      } else {
        setQueryError("No answer received from the server.");
      }
    } catch (error) {
      console.error("Query error:", error);
      setQueryError("Failed to get response. Please try again.");
    } finally {
      setIsQueryLoading(false);
    }
  };

  return (
    <div className="min-h-screen gradient-bg">
      {/* Header */}
      <motion.header 
        className="bg-white/80 backdrop-blur-sm border-b border-gray-200"
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-4">
            <motion.button
              className="flex items-center space-x-2 text-gray-600 hover:text-primary-600 transition-colors"
              onClick={() => navigate('/')}
              whileHover={{ x: -5 }}
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Back to Home</span>
            </motion.button>
            
            <motion.div 
              className="flex items-center space-x-2"
              whileHover={{ scale: 1.05 }}
            >
              <MessageSquare className="w-8 h-8 text-primary-600" />
              <span className="text-2xl font-bold text-gray-900">ThreadScribe</span>
            </motion.div>
          </div>
        </div>
      </motion.header>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Upload WhatsApp Chat
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Upload your WhatsApp chat export file and let our AI analyze it into actionable insights
          </p>
        </motion.div>

        {/* Upload Area */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="card max-w-2xl mx-auto"
        >
          <div
            className={`relative border-2 border-dashed rounded-xl p-12 text-center transition-colors duration-200 ${
              dragActive 
                ? 'border-primary-500 bg-primary-50' 
                : file 
                  ? 'border-green-500 bg-green-50' 
                  : 'border-gray-300 hover:border-primary-400'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <input
              type="file"
              accept=".txt"
              onChange={handleFileChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            
            <motion.div
              animate={{ 
                scale: dragActive ? 1.1 : 1,
                rotate: dragActive ? 5 : 0 
              }}
              transition={{ duration: 0.2 }}
            >
              {file ? (
                <div className="space-y-4">
                  <FileText className="w-16 h-16 text-green-500 mx-auto" />
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      File Selected
                    </h3>
                    <p className="text-gray-600 mb-4">{file.name}</p>
                    <p className="text-sm text-gray-500">
                      {(file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <Upload className="w-16 h-16 text-gray-400 mx-auto" />
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      Drop your WhatsApp chat file here
                    </h3>
                    <p className="text-gray-600 mb-4">
                      or click to browse files
                    </p>
                    <p className="text-sm text-gray-500">
                      Supports .txt files exported from WhatsApp
                    </p>
                  </div>
                </div>
              )}
            </motion.div>
          </div>

          {/* Upload Button */}
          <motion.div 
            className="mt-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            <motion.button
              className={`w-full py-3 px-6 rounded-lg font-medium transition-colors duration-200 flex items-center justify-center space-x-2 ${
                file && !isUploading
                  ? 'bg-primary-600 hover:bg-primary-700 text-white'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
              onClick={handleUpload}
              disabled={!file || isUploading}
              whileHover={file && !isUploading ? { scale: 1.02 } : {}}
              whileTap={file && !isUploading ? { scale: 0.98 } : {}}
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <Upload className="w-5 h-5" />
                  <span>Analyze Chat</span>
                </>
              )}
            </motion.button>
          </motion.div>
        </motion.div>

        {/* Query Section */}
        {file && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="mt-8 max-w-2xl mx-auto"
          >
            <div className="card bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
              <div className="flex items-center mb-4">
                <span className="text-2xl mr-3">🤖</span>
                <h3 className="text-xl font-semibold text-gray-800">
                  Ask Questions About Your Chat
                </h3>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700">
                    Enter your question:
                  </label>
                  <textarea
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="e.g., What were the key decisions made? Who mentioned important deadlines? What was the main topic discussed?"
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition resize-none"
                    rows={3}
                    disabled={isQueryLoading}
                  />
                </div>

                {queryError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-red-600 text-sm">{queryError}</p>
                  </div>
                )}

                <motion.button
                  onClick={handleQuery}
                  disabled={isQueryLoading}
                  className={`w-full py-3 rounded-lg text-white font-semibold transition flex items-center justify-center ${
                    isQueryLoading
                      ? "bg-gray-400 cursor-not-allowed"
                      : "bg-indigo-600 hover:bg-indigo-700"
                  }`}
                  whileHover={!isQueryLoading ? { scale: 1.02 } : {}}
                  whileTap={!isQueryLoading ? { scale: 0.98 } : {}}
                >
                  {isQueryLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin mr-2" />
                      <span>Processing...</span>
                    </>
                  ) : (
                    "Ask Question"
                  )}
                </motion.button>
              </div>

              {response && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="mt-6 bg-white p-4 border border-gray-200 rounded-lg shadow-sm"
                >
                  <div className="flex items-center mb-3">
                    <span className="text-green-500 mr-2">✓</span>
                    <h4 className="font-semibold text-gray-800">AI Response:</h4>
                  </div>
                  <div className="prose prose-sm max-w-none">
                    <p className="text-gray-700 whitespace-pre-wrap">{response}</p>
                  </div>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}

        {/* Instructions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="mt-12 max-w-2xl mx-auto"
        >
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              How to export your WhatsApp chat:
            </h3>
            <ol className="list-decimal list-inside space-y-2 text-gray-600">
              <li>Open WhatsApp and go to the chat you want to analyze</li>
              <li>Tap on the chat name at the top</li>
              <li>Scroll down and tap "Export chat"</li>
              <li>Choose "Without Media" to get a smaller file</li>
              <li>Save the file and upload it here</li>
            </ol>
          </div>
        </motion.div>

        {/* Alternative Options */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.8 }}
          className="mt-8 text-center"
        >
          <p className="text-gray-600 mb-4">Or try our live analysis feature:</p>
          <motion.button
            className="btn-secondary"
            onClick={() => navigate('/whatsapp-live')}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Connect WhatsApp Live
          </motion.button>
        </motion.div>
      </div>
    </div>
  );
};

export default UploadPage;
