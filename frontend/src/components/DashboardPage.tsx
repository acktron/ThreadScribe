import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  BarChart3, 
  TrendingUp, 
  Users, 
  MessageSquare, 
  CheckCircle,
  AlertCircle,
  Clock,
  Calendar,
  Activity,
  Zap
} from 'lucide-react';

interface DashboardStats {
  totalChats: number;
  totalMessages: number;
  totalTasks: number;
  totalQuestions: number;
  totalDecisions: number;
  sentimentScore: number;
  activeUsers: number;
  lastActivity: string;
}

const DashboardPage = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats>({
    totalChats: 0,
    totalMessages: 0,
    totalTasks: 0,
    totalQuestions: 0,
    totalDecisions: 0,
    sentimentScore: 0,
    activeUsers: 0,
    lastActivity: ''
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate loading dashboard data
    const loadDashboardData = async () => {
      try {
        // In a real app, this would fetch from your backend
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        setStats({
          totalChats: 24,
          totalMessages: 1247,
          totalTasks: 18,
          totalQuestions: 32,
          totalDecisions: 12,
          sentimentScore: 0.75,
          activeUsers: 8,
          lastActivity: new Date().toISOString()
        });
      } catch (error) {
        console.error('Failed to load dashboard data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadDashboardData();
  }, []);

  const recentActivities = [
    { id: 1, type: 'task', message: 'New task identified: "Schedule team meeting"', time: '2 minutes ago', icon: CheckCircle },
    { id: 2, type: 'question', message: 'Question found: "What time works best for everyone?"', time: '5 minutes ago', icon: AlertCircle },
    { id: 3, type: 'decision', message: 'Decision made: "Project deadline extended to next Friday"', time: '8 minutes ago', icon: BarChart3 },
    { id: 4, type: 'message', message: 'New message from John in Project Alpha chat', time: '12 minutes ago', icon: MessageSquare },
  ];

  const quickActions = [
    {
      title: 'Upload New Chat',
      description: 'Analyze a WhatsApp chat export',
      icon: MessageSquare,
      color: 'bg-primary-500',
      action: () => navigate('/upload')
    },
    {
      title: 'Live Analysis',
      description: 'Monitor WhatsApp in real-time',
      icon: Zap,
      color: 'bg-green-500',
      action: () => navigate('/whatsapp-live')
    },
    {
      title: 'View Reports',
      description: 'Generate detailed analytics',
      icon: BarChart3,
      color: 'bg-purple-500',
      action: () => navigate('/reports')
    },
    {
      title: 'Export Data',
      description: 'Download analysis results',
      icon: TrendingUp,
      color: 'bg-orange-500',
      action: () => console.log('Export data')
    }
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

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
              <BarChart3 className="w-8 h-8 text-primary-600" />
              <span className="text-2xl font-bold text-gray-900">ThreadScribe Dashboard</span>
            </motion.div>
          </div>
        </div>
      </motion.header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Welcome to ThreadScribe Dashboard
          </h1>
          <p className="text-gray-600">
            Monitor your chat analysis and insights in real-time
          </p>
        </motion.div>

        {/* Stats Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8"
        >
          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Chats</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalChats}</p>
              </div>
              <MessageSquare className="w-8 h-8 text-primary-600" />
            </div>
          </div>

          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Messages</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalMessages.toLocaleString()}</p>
              </div>
              <Activity className="w-8 h-8 text-green-600" />
            </div>
          </div>

          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Tasks Identified</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalTasks}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-blue-600" />
            </div>
          </div>

          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Sentiment Score</p>
                <p className="text-2xl font-bold text-gray-900">{(stats.sentimentScore * 100).toFixed(0)}%</p>
              </div>
              <TrendingUp className="w-8 h-8 text-purple-600" />
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Quick Actions */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="lg:col-span-1"
          >
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
              <div className="space-y-3">
                {quickActions.map((action, index) => (
                  <motion.button
                    key={index}
                    className="w-full p-3 rounded-lg border border-gray-200 hover:border-primary-300 hover:bg-primary-50 transition-colors duration-200 text-left"
                    onClick={action.action}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <div className="flex items-center space-x-3">
                      <div className={`w-8 h-8 rounded-lg ${action.color} flex items-center justify-center`}>
                        <action.icon className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{action.title}</p>
                        <p className="text-sm text-gray-600">{action.description}</p>
                      </div>
                    </div>
                  </motion.button>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Recent Activity */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="lg:col-span-2"
          >
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
              <div className="space-y-4">
                {recentActivities.map((activity, index) => (
                  <motion.div
                    key={activity.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.1 }}
                    className="flex items-start space-x-3 p-3 rounded-lg hover:bg-gray-50 transition-colors duration-200"
                  >
                    <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                      <activity.icon className="w-4 h-4 text-gray-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-gray-900">{activity.message}</p>
                      <p className="text-xs text-gray-500 mt-1">{activity.time}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>

        {/* Additional Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.8 }}
          className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6"
        >
          <div className="card text-center">
            <AlertCircle className="w-8 h-8 text-orange-600 mx-auto mb-2" />
            <div className="text-2xl font-bold text-gray-900">{stats.totalQuestions}</div>
            <div className="text-gray-600">Questions Found</div>
          </div>
          
          <div className="card text-center">
            <BarChart3 className="w-8 h-8 text-purple-600 mx-auto mb-2" />
            <div className="text-2xl font-bold text-gray-900">{stats.totalDecisions}</div>
            <div className="text-gray-600">Decisions Made</div>
          </div>
          
          <div className="card text-center">
            <Users className="w-8 h-8 text-green-600 mx-auto mb-2" />
            <div className="text-2xl font-bold text-gray-900">{stats.activeUsers}</div>
            <div className="text-gray-600">Active Users</div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default DashboardPage;
