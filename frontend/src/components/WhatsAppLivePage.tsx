import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import axios from 'axios';
import { 
  MessageSquare, 
  Users, 
  AlertCircle, 
  Loader2, 
  LogOut,
  RefreshCw,
  CheckCircle
} from 'lucide-react';

interface Chat {
  id: string;
  name: string;
  lastMessage: string;
  timestamp: string;
  unreadCount: number;
}

interface Message {
  id: string;
  sender: string;
  content: string;
  timestamp: string;
  type: string;
}

const WhatsAppLivePage: React.FC = () => {
  console.log('WhatsAppLivePage component rendering...');
  
  // Core state
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  
  // UI state
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isRegeneratingQR, setIsRegeneratingQR] = useState(false);
  const [qrCountdown, setQrCountdown] = useState(30);

  // Check connection status
  const checkConnection = async () => {
    try {
      console.log('Checking connection status...');
      const response = await axios.get('http://localhost:8081/api/status');
      const connected = response.data.connected;
      console.log('Connection status:', connected);
      
      // Force state update if connection status changed
      if (connected !== isConnected) {
        console.log('Connection status changed from', isConnected, 'to', connected);
        setIsConnected(connected);
        
        if (connected) {
          console.log('Just connected! Fetching chats...');
          await fetchChats();
        } else {
          console.log('Just disconnected! Fetching QR code...');
          await fetchQRCode();
        }
      }
      
      return connected;
    } catch (error) {
      console.error('Connection check failed:', error);
      console.error('Error details:', (error as any).response?.data || (error as any).message);
      setIsConnected(false);
      setQrCode(null);
      return false;
    }
  };

  // Regenerate QR code by restarting bridge
  const regenerateQRCode = async () => {
    try {
      console.log('Regenerating QR code by restarting bridge...');
      const response = await axios.post('http://localhost:8081/api/restart');
      console.log('Bridge restart response:', response.data);
      
      if (response.data.success) {
        // Wait for bridge to restart and generate new QR
        setTimeout(async () => {
          await fetchQRCode();
        }, 5000);
      }
    } catch (error) {
      console.error('QR regeneration failed:', error);
      console.error('Error details:', (error as any).response?.data || (error as any).message);
    }
  };

  // Fetch QR code
  const fetchQRCode = async () => {
    try {
      console.log('Fetching QR code from http://localhost:8081/api/qr');
      const response = await axios.get('http://localhost:8081/api/qr', {
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      console.log('QR API Response:', response.data);
      
      if (response.data.qr && !response.data.error) {
        setQrCode(response.data.qr);
        console.log('QR code loaded successfully, length:', response.data.qr.length);
      } else {
        setQrCode(null);
        console.log('QR code not available:', response.data);
      }
    } catch (error) {
      console.error('QR code fetch failed:', error);
      console.error('Error details:', (error as any).response?.data || (error as any).message);
      setQrCode(null);
    }
  };

  // Fetch chats
  const fetchChats = async () => {
    try {
      console.log('Fetching chats...');
      const response = await axios.get('http://localhost:8081/api/chats');
      console.log('Chats API response:', response.data);
      
      // Convert the response data to array format
      const chatsArray = Object.entries(response.data).map(([id, chat]: [string, any]) => ({
        id,
        name: chat.name,
        lastMessage: 'No messages yet',
        timestamp: chat.timestamp,
        unreadCount: 0
      }));
      
      console.log('Processed chats array:', chatsArray);
      setChats(chatsArray);
    } catch (error) {
      console.error('Failed to fetch chats:', error);
      setChats([]);
    }
  };

  // Fetch messages for selected chat
  const fetchMessages = async (chatId: string) => {
    try {
      const response = await axios.get(`http://localhost:8081/api/messages?chatId=${chatId}`);
      setMessages(response.data);
    } catch (error) {
      console.error('Failed to fetch messages:', error);
      setMessages([]);
    }
  };

  // Logout function
  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      const response = await axios.post('http://localhost:8081/api/logout');
      if (response.data.success) {
        // Clear state
        setIsConnected(false);
        setChats([]);
        setSelectedChat(null);
        setMessages([]);
        setQrCode(null);
        
        console.log('Logged out successfully');
        
        // Restart the Go bridge
        await restartBridge();
        
      } else {
        console.error('Logout failed:', response.data.message);
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  // Restart Go bridge
  const restartBridge = async () => {
    try {
      // Kill existing bridge process
      await axios.post('http://localhost:8081/api/restart');
      
      // Wait for bridge to restart
      setIsRefreshing(true);
      
      // Poll for bridge to be ready
      let attempts = 0;
      const maxAttempts = 30; // 30 seconds max
      
      const pollBridge = async () => {
        try {
          const response = await axios.get('http://localhost:8081/api/status');
          if (response.status === 200) {
            setIsRefreshing(false);
            // Fetch new QR code
            await fetchQRCode();
            return;
          }
        } catch (error) {
          // Bridge not ready yet
        }
        
        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(pollBridge, 1000);
        } else {
          setIsRefreshing(false);
          console.error('Bridge restart timeout');
        }
      };
      
      setTimeout(pollBridge, 2000); // Wait 2 seconds before polling
      
    } catch (error) {
      console.error('Bridge restart failed:', error);
      setIsRefreshing(false);
    }
  };

  // Manual QR refresh
  const handleRefreshQR = async () => {
    setIsRefreshing(true);
    await fetchQRCode();
    setIsRefreshing(false);
  };

  // Initial load
  useEffect(() => {
    const initialize = async () => {
      console.log('Component mounted, initializing...');
      setIsLoading(true);
      const connected = await checkConnection();
      
      if (connected) {
        console.log('Connected, fetching chats...');
        await fetchChats();
      } else {
        console.log('Not connected, should show QR code');
      }
      
      setIsLoading(false);
      console.log('Initialization complete');
    };
    
    initialize();
  }, []);

  // Periodic connection check
  useEffect(() => {
    console.log('Setting up periodic connection check...');
    const interval = setInterval(async () => {
      if (!isLoggingOut && !isRefreshing) {
        console.log('Periodic check running...');
        await checkConnection();
      }
    }, 1000); // Check every 1 second

    return () => {
      console.log('Clearing periodic connection check interval');
      clearInterval(interval);
    };
  }, [isLoggingOut, isRefreshing]);

  // QR code regeneration timer
  useEffect(() => {
    if (!isConnected && !isLoading) {
      console.log('Setting up QR code regeneration timer...');
      setQrCountdown(30); // Reset countdown
      
      const qrInterval = setInterval(async () => {
        console.log('Regenerating QR code...');
        setIsRegeneratingQR(true);
        await regenerateQRCode();
        setIsRegeneratingQR(false);
        setQrCountdown(30); // Reset countdown after regeneration
      }, 30000); // Regenerate QR every 30 seconds

      return () => {
        console.log('Clearing QR regeneration timer');
        clearInterval(qrInterval);
      };
    }
  }, [isConnected, isLoading]);

  // QR countdown timer
  useEffect(() => {
    if (!isConnected && !isLoading && !isRegeneratingQR) {
      const countdownInterval = setInterval(() => {
        setQrCountdown(prev => {
          if (prev <= 1) {
            return 30; // Reset to 30 when it reaches 0
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(countdownInterval);
    }
  }, [isConnected, isLoading, isRegeneratingQR]);

  // Fetch messages when chat is selected
  useEffect(() => {
    if (selectedChat && isConnected) {
      fetchMessages(selectedChat.id);
      const interval = setInterval(() => {
        fetchMessages(selectedChat.id);
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [selectedChat, isConnected]);

  // Loading state
  if (isLoading) {
    console.log('Rendering loading state');
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary-600 mx-auto mb-4" />
          <p className="text-gray-600">Checking WhatsApp connection...</p>
          <p className="text-xs text-gray-400 mt-2">Debug: Loading state active</p>
        </div>
      </div>
    );
  }

  // Not connected state
  if (!isConnected) {
    console.log('Rendering not connected state, qrCode:', qrCode ? 'Present' : 'Null');
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-4">
              <div className="flex items-center space-x-3">
                <MessageSquare className="w-8 h-8 text-primary-600" />
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">WhatsApp Live Analysis</h1>
                  <p className="text-sm text-gray-500">Real-time chat monitoring</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                <motion.button
                  onClick={handleRefreshQR}
                  disabled={isRefreshing}
                  className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {isRefreshing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  <span>{isRefreshing ? 'Refreshing...' : 'Refresh QR'}</span>
                </motion.button>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center"
          >
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-6" />
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              WhatsApp Not Connected
            </h2>
            <p className="text-gray-600 mb-8 max-w-md mx-auto">
              Scan the QR code below with your WhatsApp mobile app to connect and start monitoring chats.
            </p>
            
            {/* QR Code Section */}
            <div className="mb-8">
              {(() => {
                console.log('Rendering QR section:', { isRefreshing, isRegeneratingQR, qrCode: qrCode ? 'Present' : 'Null' });
                return null;
              })()}
              {isRefreshing || isRegeneratingQR ? (
                <div className="bg-white p-8 rounded-lg shadow-lg inline-block">
                  <Loader2 className="w-16 h-16 animate-spin text-primary-600 mx-auto mb-4" />
                  <p className="text-gray-500">
                    {isRegeneratingQR ? 'Refreshing QR code...' : 'Generating new QR code...'}
                  </p>
                  {isRegeneratingQR && (
                    <p className="text-xs text-gray-400 mt-2">QR codes expire every 30 seconds</p>
                  )}
                </div>
              ) : qrCode ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5 }}
                  className="bg-white p-6 rounded-lg shadow-lg inline-block"
                >
                  <img
                    src={qrCode}
                    alt="WhatsApp QR Code"
                    className="w-64 h-64 mx-auto"
                    onLoad={() => console.log('QR code image loaded successfully')}
                    onError={(e) => {
                      console.log('QR code image failed to load:', e);
                      setQrCode(null);
                    }}
                  />
                  <p className="text-sm text-gray-500 mt-4">
                    Scan this QR code with WhatsApp on your phone
                  </p>
                  <div className="mt-2 flex items-center justify-center space-x-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <p className="text-xs text-gray-400">
                      Next refresh in {qrCountdown}s
                    </p>
                  </div>
                </motion.div>
              ) : (
                <div className="bg-white p-8 rounded-lg shadow-lg inline-block">
                  <Loader2 className="w-16 h-16 animate-spin text-primary-600 mx-auto mb-4" />
                  <p className="text-gray-500">Loading QR code...</p>
                  <p className="text-xs text-gray-400 mt-2">Debug: qrCode is null</p>
                </div>
              )}
            </div>
            
            {/* Debug buttons for testing */}
            <div className="mt-6 space-x-4">
              <button
                onClick={async () => {
                  console.log('Manual QR fetch triggered');
                  await fetchQRCode();
                }}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Fetch QR Code
              </button>
              
              <button
                onClick={async () => {
                  console.log('Manual connection check triggered');
                  await checkConnection();
                }}
                className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
              >
                Check Connection
              </button>
              
              <button
                onClick={() => {
                  console.log('Current state:', {
                    isConnected,
                    isLoading,
                    qrCode: qrCode ? 'Present' : 'Null',
                    qrCodeLength: qrCode?.length || 0,
                    chatsLength: chats.length
                  });
                }}
                className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
              >
                Log State
              </button>
              
              <button
                onClick={async () => {
                  console.log('Manual connection check...');
                  const connected = await checkConnection();
                  console.log('Manual check result:', connected);
                  if (connected) {
                    console.log('Fetching chats manually...');
                    await fetchChats();
                  }
                }}
                className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600"
              >
                Force Check
              </button>
            </div>

            {/* Instructions */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 max-w-md mx-auto mt-6">
              <h3 className="font-semibold text-blue-900 mb-3">How to connect:</h3>
              <div className="space-y-2 text-sm text-blue-800 text-left">
                <p>1. Open WhatsApp on your phone</p>
                <p>2. Go to Settings → Linked Devices</p>
                <p>3. Tap "Link a Device"</p>
                <p>4. Scan the QR code above</p>
                <p>5. This page will automatically update once connected</p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  // Connected state - show chats and messages
  console.log('Rendering connected state, chats.length:', chats.length, 'selectedChat:', selectedChat?.name || 'None');
  
  try {
    return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-3">
              <CheckCircle className="w-8 h-8 text-green-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">WhatsApp Live Analysis</h1>
                <p className="text-sm text-green-600">Connected and monitoring</p>
              </div>
            </div>
            
            <motion.button
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {isLoggingOut ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <LogOut className="w-4 h-4" />
              )}
              <span>{isLoggingOut ? 'Disconnecting...' : 'Disconnect'}</span>
            </motion.button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Chats Sidebar */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="lg:col-span-1"
          >
            <div className="bg-white rounded-lg shadow-sm border">
              <div className="p-4 border-b">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                  <Users className="w-5 h-5 mr-2" />
                  Chats ({chats.length})
                </h2>
              </div>
              
              <div className="max-h-96 overflow-y-auto">
                {Array.isArray(chats) && chats.map((chat) => (
                  <motion.div
                    key={chat.id}
                    onClick={() => setSelectedChat(chat)}
                    className={`p-4 border-b cursor-pointer transition-colors ${
                      selectedChat?.id === chat.id
                        ? 'bg-primary-50 border-primary-200'
                        : 'hover:bg-gray-50'
                    }`}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium text-gray-900 truncate">
                        {chat.name}
                      </h3>
                      {chat.unreadCount > 0 && (
                        <span className="bg-red-500 text-white text-xs rounded-full px-2 py-1">
                          {chat.unreadCount}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 truncate mt-1">
                      {chat.lastMessage}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {chat.timestamp}
                    </p>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Messages Area */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="lg:col-span-2"
          >
            {selectedChat ? (
              <div className="bg-white rounded-lg shadow-sm border">
                <div className="p-4 border-b">
                  <h2 className="text-lg font-semibold text-gray-900">
                    {selectedChat.name}
                  </h2>
                </div>
                
                <div className="h-96 overflow-y-auto p-4">
                  {messages.map((message) => (
                    <motion.div
                      key={message.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`mb-4 ${
                        message.sender === 'You' ? 'text-right' : 'text-left'
                      }`}
                    >
                      <div
                        className={`inline-block max-w-xs p-3 rounded-lg ${
                          message.sender === 'You'
                            ? 'bg-primary-600 text-white'
                            : 'bg-gray-200 text-gray-900'
                        }`}
                      >
                        <p className="text-sm">{message.content}</p>
                        <p className="text-xs opacity-75 mt-1">
                          {message.timestamp}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-sm border h-96 flex items-center justify-center">
                <div className="text-center text-gray-500">
                  <MessageSquare className="w-12 h-12 mx-auto mb-4" />
                  <p>Select a chat to view messages</p>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
    );
  } catch (error) {
    console.error('Error rendering WhatsAppLivePage:', error);
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Error Loading Page</h2>
          <p className="text-gray-600 mb-4">Something went wrong while loading the WhatsApp Live Analysis page.</p>
          <button 
            onClick={() => window.location.reload()} 
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Reload Page
          </button>
          <p className="text-xs text-gray-400 mt-4">Check console for error details</p>
        </div>
      </div>
    );
  }
};

export default WhatsAppLivePage;