import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  CheckCircle, 
  HelpCircle, 
  Gavel, 
  Lightbulb, 
  ArrowLeft, 
  Download,
  Share2,
  MessageSquare,
  TrendingUp,
  Users,
  Calendar
} from 'lucide-react';

interface ProcessedChat {
  messages: Array<{
    sender: string;
    content: string;
    timestamp: string;
    message_type: string;
  }>;
  summary: {
    tasks: string[];
    questions: string[];
    decisions: string[];
    key_points: string[];
    sentiment_analysis: {
      positive: number;
      negative: number;
      neutral: number;
      total_messages: number;
    };
    participants: string[];
    summary: string;
  };
  metadata: {
    total_messages: number;
    participants: number;
    date_range: {
      start: string;
      end: string;
    };
    processed_at: string;
  };
}

const ResultsPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { processedChat, fileName } = location.state as { 
    processedChat: ProcessedChat; 
    fileName: string; 
  };

  const [activeTab, setActiveTab] = useState<'overview' | 'tasks' | 'questions' | 'decisions' | 'sentiment'>('overview');

  if (!processedChat) {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">No Data Available</h1>
          <button 
            className="btn-primary"
            onClick={() => navigate('/upload')}
          >
            Go Back to Upload
          </button>
        </div>
      </div>
    );
  }

  const { summary, metadata } = processedChat;

  const tabs = [
    { id: 'overview', label: 'Overview', icon: <MessageSquare className="w-4 h-4" /> },
    { id: 'tasks', label: 'Tasks', icon: <CheckCircle className="w-4 h-4" /> },
    { id: 'questions', label: 'Questions', icon: <HelpCircle className="w-4 h-4" /> },
    { id: 'decisions', label: 'Decisions', icon: <Gavel className="w-4 h-4" /> },
    { id: 'sentiment', label: 'Sentiment', icon: <TrendingUp className="w-4 h-4" /> },
  ];

  const getSentimentColor = (type: 'positive' | 'negative' | 'neutral') => {
    switch (type) {
      case 'positive': return 'text-green-600 bg-green-100';
      case 'negative': return 'text-red-600 bg-red-100';
      case 'neutral': return 'text-gray-600 bg-gray-100';
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
              onClick={() => navigate('/upload')}
              whileHover={{ x: -5 }}
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Back to Upload</span>
            </motion.button>
            
            <div className="flex items-center space-x-4">
              <motion.button
                className="btn-secondary flex items-center space-x-2"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Share2 className="w-4 h-4" />
                <span>Share</span>
              </motion.button>
              <motion.button
                className="btn-primary flex items-center space-x-2"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Download className="w-4 h-4" />
                <span>Export</span>
              </motion.button>
            </div>
          </div>
        </div>
      </motion.header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Title */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Chat Analysis Results
          </h1>
          <p className="text-gray-600">
            Analysis of: <span className="font-medium">{fileName}</span>
          </p>
        </motion.div>

        {/* Stats Cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8"
        >
          <div className="card text-center">
            <MessageSquare className="w-8 h-8 text-primary-600 mx-auto mb-2" />
            <div className="text-2xl font-bold text-gray-900">{metadata.total_messages}</div>
            <div className="text-gray-600">Total Messages</div>
          </div>
          
          <div className="card text-center">
            <Users className="w-8 h-8 text-primary-600 mx-auto mb-2" />
            <div className="text-2xl font-bold text-gray-900">{metadata.participants}</div>
            <div className="text-gray-600">Participants</div>
          </div>
          
          <div className="card text-center">
            <CheckCircle className="w-8 h-8 text-green-600 mx-auto mb-2" />
            <div className="text-2xl font-bold text-gray-900">{summary.tasks.length}</div>
            <div className="text-gray-600">Tasks Found</div>
          </div>
          
          <div className="card text-center">
            <Calendar className="w-8 h-8 text-primary-600 mx-auto mb-2" />
            <div className="text-sm font-medium text-gray-900">
              {new Date(metadata.date_range.start).toLocaleDateString()}
            </div>
            <div className="text-gray-600">Date Range</div>
          </div>
        </motion.div>

        {/* Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mb-8"
        >
          <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                className={`flex items-center space-x-2 px-4 py-2 rounded-md transition-colors duration-200 ${
                  activeTab === tab.id
                    ? 'bg-white text-primary-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
                onClick={() => setActiveTab(tab.id as any)}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </motion.div>

        {/* Tab Content */}
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Summary */}
              <div className="card">
                <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                  <Lightbulb className="w-5 h-5 text-yellow-500 mr-2" />
                  Summary
                </h3>
                <p className="text-gray-700 leading-relaxed">{summary.summary}</p>
              </div>

              {/* Key Points */}
              <div className="card">
                <h3 className="text-xl font-semibold text-gray-900 mb-4">Key Points</h3>
                <div className="space-y-2">
                  {summary.key_points.map((point, index) => (
                    <div key={index} className="flex items-start space-x-3">
                      <div className="w-2 h-2 bg-primary-500 rounded-full mt-2 flex-shrink-0"></div>
                      <p className="text-gray-700">{point}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Participants */}
              <div className="card">
                <h3 className="text-xl font-semibold text-gray-900 mb-4">Participants</h3>
                <div className="flex flex-wrap gap-2">
                  {summary.participants.map((participant, index) => (
                    <span
                      key={index}
                      className="px-3 py-1 bg-primary-100 text-primary-800 rounded-full text-sm"
                    >
                      {participant}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'tasks' && (
            <div className="card">
              <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
                Tasks ({summary.tasks.length})
              </h3>
              <div className="space-y-3">
                {summary.tasks.map((task, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.1 }}
                    className="flex items-start space-x-3 p-3 bg-green-50 rounded-lg"
                  >
                    <input
                      type="checkbox"
                      className="mt-1 w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                    />
                    <p className="text-gray-700">{task}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'questions' && (
            <div className="card">
              <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                <HelpCircle className="w-5 h-5 text-blue-500 mr-2" />
                Questions ({summary.questions.length})
              </h3>
              <div className="space-y-3">
                {summary.questions.map((question, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.1 }}
                    className="p-3 bg-blue-50 rounded-lg"
                  >
                    <p className="text-gray-700">{question}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'decisions' && (
            <div className="card">
              <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                <Gavel className="w-5 h-5 text-purple-500 mr-2" />
                Decisions ({summary.decisions.length})
              </h3>
              <div className="space-y-3">
                {summary.decisions.map((decision, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.1 }}
                    className="p-3 bg-purple-50 rounded-lg"
                  >
                    <p className="text-gray-700">{decision}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'sentiment' && (
            <div className="card">
              <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                <TrendingUp className="w-5 h-5 text-orange-500 mr-2" />
                Sentiment Analysis
              </h3>
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">{summary.sentiment_analysis.positive}</div>
                    <div className="text-green-600">Positive</div>
                  </div>
                  <div className="text-center p-4 bg-red-50 rounded-lg">
                    <div className="text-2xl font-bold text-red-600">{summary.sentiment_analysis.negative}</div>
                    <div className="text-red-600">Negative</div>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <div className="text-2xl font-bold text-gray-600">{summary.sentiment_analysis.neutral}</div>
                    <div className="text-gray-600">Neutral</div>
                  </div>
                </div>
                
                <div className="mt-4">
                  <div className="text-sm text-gray-600 mb-2">
                    Overall Sentiment Distribution
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div className="flex h-3 rounded-full overflow-hidden">
                      <div 
                        className="bg-green-500"
                        style={{ 
                          width: `${(summary.sentiment_analysis.positive / summary.sentiment_analysis.total_messages) * 100}%` 
                        }}
                      ></div>
                      <div 
                        className="bg-red-500"
                        style={{ 
                          width: `${(summary.sentiment_analysis.negative / summary.sentiment_analysis.total_messages) * 100}%` 
                        }}
                      ></div>
                      <div 
                        className="bg-gray-500"
                        style={{ 
                          width: `${(summary.sentiment_analysis.neutral / summary.sentiment_analysis.total_messages) * 100}%` 
                        }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default ResultsPage;
