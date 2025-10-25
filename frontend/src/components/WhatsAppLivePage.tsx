import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import axios from 'axios';
import { 
  MessageSquare, 
  Users, 
  AlertCircle, 
  Loader2, 
  LogOut,
  RefreshCw,
  CheckCircle,
  Bot,
  Send,
  Trash2
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
  formattedTimestamp?: string;
  fromMe?: boolean;
  body?: string;
  text?: string;
  from?: string;
}

// Chat Analysis interfaces
interface ChatAnalysisMessage {
  id: string;
  question: string;
  answer: string;
  timestamp: number;
  error?: string;
  status: 'pending' | 'complete' | 'error';
  isContactSpecific: boolean;
}

interface ChatAnalysisState {
  messages: ChatAnalysisMessage[];
  lastUpdated: number;
  totalQuestions: number;
  errorCount: number;
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
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [, setRawMessages] = useState<any[]>([]);
  
  // UI state
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isRegeneratingQR, setIsRegeneratingQR] = useState(false);
  const [qrCountdown, setQrCountdown] = useState(30);
  const [currentUserJID, setCurrentUserJID] = useState('');

  // Chat Analysis state
  const [chatAnalysisConversations, setChatAnalysisConversations] = useState<Record<string, ChatAnalysisState>>({});
  const [chatAnalysisQuery, setChatAnalysisQuery] = useState("");
  const [isChatAnalysisLoading, setIsChatAnalysisLoading] = useState(false);
  const chatAnalysisMessagesContainerRef = useRef<HTMLDivElement>(null);
  const [chatAnalysisError, setChatAnalysisError] = useState<string | null>(null);

  // Message display refs
  const messagesContainerRef = useRef<HTMLDivElement>(null);

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
  const parseMessageContent = (content: string) => {
    if (!content || typeof content !== 'string') {
      return { text: '', timestamp: '' };
    }
    
    // Handle different message formats
    const lines = content.split('\n');
    
    // If content contains timestamp patterns, extract them
    const timestampPatterns = [
      /(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2})/, // ISO format
      /(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})/, // Standard format
      /(\d{2}\/\d{2}\/\d{4}, \d{2}:\d{2} [AP]M)/, // WhatsApp format
      /(\d{2}\/\d{2}\/\d{2}, \d{2}:\d{2})/, // Short format
    ];
    
    let messageText = content;
    let timestamp = '';
    
    // Try to find and extract timestamp
    for (const pattern of timestampPatterns) {
      const match = content.match(pattern);
      if (match) {
        timestamp = match[1];
        messageText = content.replace(pattern, '').trim();
        break;
      }
    }
    
    // If no timestamp found, try splitting by newlines
    if (!timestamp && lines.length > 1) {
      messageText = lines[0] || '';
      timestamp = lines[1] || '';
    }
    
    // Additional parsing for WhatsApp message format: "Sender: Message"
    if (messageText.includes(':') && !timestamp) {
      const colonIndex = messageText.indexOf(':');
      const text = messageText.substring(colonIndex + 1).trim();
      
      // If this looks like a WhatsApp message format, extract the text
      if (text && text.length > 0) {
        messageText = text;
      }
    }
    
    // Clean up the message text
    messageText = messageText.replace(/^\s*-\s*/, ''); // Remove leading dash
    messageText = messageText.replace(/^\s*:\s*/, ''); // Remove leading colon
    messageText = messageText.trim();
    
    return {
      text: messageText,
      timestamp: timestamp.trim()
    };
  };

  const formatTimestamp = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) {
        return timestamp; // Return original if parsing fails
      }
      
      const now = new Date();
      const isToday = date.toDateString() === now.toDateString();
      const isYesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toDateString() === date.toDateString();
      
      if (isToday) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      } else if (isYesterday) {
        return `Yesterday ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      } else {
        return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      }
    } catch (error) {
      return timestamp;
    }
  };

  const fetchMessages = async (chatId: string) => {
    try {
      setIsLoadingMessages(true);
      
      // Request messages from MCP server
      const response = await axios.get(`http://localhost:8081/api/messages?chatId=${chatId}`);
      const rawMessages = response.data;
      
      
      setRawMessages(rawMessages);
      
      // Parse and clean the messages
      const parsedMessages = rawMessages.map((msg: any, index: number) => {
        
        // Simple content extraction - just check the most common fields in order
        const finalContent = msg.body || msg.content || msg.text || msg.message || msg.data || 'No content';
        
        // Determine sender - check for fromMe field or sender field
        const senderId = msg.sender || msg.from || msg.name || '';
        
        // Determine if message is from me - simple logic
        const isFromMe = msg.fromMe === true || 
                        msg.fromMe === 'true' || 
                        senderId === 'You' || 
                        msg.sender === 'You' || 
                        msg.from === 'You' ||
                        senderId === currentUserJID ||
                        msg.sender === currentUserJID;
        
        const sender = isFromMe ? 'You' : (senderId || 'Unknown');
        
        return {
          ...msg,
          id: msg.id || `msg-${index}-${Date.now()}`,
          content: finalContent,
          sender: sender,
          fromMe: isFromMe,
          timestamp: msg.timestamp || msg.time || new Date().toISOString(),
          formattedTimestamp: formatTimestamp(msg.timestamp || msg.time || new Date().toISOString())
        };
      });
      
      // Filter out empty messages (no text content)
      const filteredMessages = parsedMessages.filter((msg: any) => {
        const hasContent = msg.content && 
                         msg.content.trim().length > 0 && 
                         msg.content !== 'No content' &&
                         msg.content !== 'null' &&
                         msg.content !== 'undefined' &&
                         !msg.content.match(/^\s*$/) &&
                         msg.content.length > 1;
        
        if (!hasContent) {
          console.log('Filtering out empty/invalid message:', {
            content: msg.content,
            length: msg.content ? msg.content.length : 0,
            trimmed: msg.content ? msg.content.trim() : '',
            msg: msg
          });
        }
        return hasContent;
      });
      
      console.log('Filtered messages count:', filteredMessages.length);
      
      setMessages(filteredMessages);
      
    } catch (error) {
      console.error('Failed to fetch messages:', error);
      setMessages([]);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  // Fetch current user JID
  const fetchCurrentUserJID = async () => {
    try {
      const response = await axios.get('http://localhost:8081/api/status');
      if (response.data.jid) {
        setCurrentUserJID(response.data.jid);
      }
    } catch (error) {
      console.error('Failed to fetch user JID:', error);
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
      setIsLoading(true);
      const connected = await checkConnection();
      
      if (connected) {
        await fetchCurrentUserJID();
        await fetchChats();
      }
      
      setIsLoading(false);
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

  // Auto-scroll to bottom when messages are loaded
  useEffect(() => {
    if (messagesContainerRef.current && messages.length > 0) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [messages.length]); // Trigger when messages change

  // Fetch messages when chat is selected
  useEffect(() => {
    if (selectedChat && isConnected) {
      fetchMessages(selectedChat.id);
      // Removed polling interval - messages will only load once when contact is selected
    }
  }, [selectedChat, isConnected]);

  // Chat Analysis functions
  const updateChatAnalysisConversation = (
    chatId: string,
    updater: (prev: ChatAnalysisState) => ChatAnalysisState
  ) => {
    setChatAnalysisConversations(prev => ({
      ...prev,
      [chatId]: updater(prev[chatId] || {
        messages: [],
        lastUpdated: Date.now(),
        totalQuestions: 0,
        errorCount: 0,
      }),
    }));
  };

  const getCurrentChatAnalysisConversation = () => {
    return selectedChat ? chatAnalysisConversations[selectedChat.id] || {
      messages: [],
      lastUpdated: 0,
      totalQuestions: 0,
      errorCount: 0,
    } : {
      messages: [],
      lastUpdated: 0,
      totalQuestions: 0,
      errorCount: 0,
    };
  };


  const formatMessagesForGemini = (messages: any[]): string => {
    return messages
      .map(msg => {
        const timestamp = new Date(msg.timestamp).toLocaleString();
        return `[${timestamp}] ${msg.sender}: ${msg.content}`;
      })
      .join('\n');
  };

  const isContactSpecificQuery = (query: string): boolean => {
    const contactSpecificKeywords = [
      'we discussed', 'our conversation', 'our chat', 'our messages',
      'yesterday', 'today', 'last week', 'recently', 'earlier',
      'how many messages', 'what did we talk about', 'what did we discuss',
      'sentiment', 'tone', 'mood', 'emotion', 'feeling',
      'decision', 'agreement', 'plan', 'schedule', 'meeting',
      'this contact', 'this person', 'this chat', 'this conversation'
    ];
    
    const lowerQuery = query.toLowerCase();
    return contactSpecificKeywords.some(keyword => lowerQuery.includes(keyword));
  };

  const sendChatAnalysisQuery = async () => {
    if (!selectedChat || !chatAnalysisQuery.trim()) return;

    const trimmedQuery = chatAnalysisQuery.trim();
    const isContactSpecific = isContactSpecificQuery(trimmedQuery);
    
    const newMessage: ChatAnalysisMessage = {
      id: `chat-analysis-${Date.now()}`,
      question: trimmedQuery,
      answer: "",
      timestamp: Date.now(),
      status: 'pending',
      isContactSpecific,
    };

    setChatAnalysisError(null);
    updateChatAnalysisConversation(selectedChat.id, prev => ({
      ...prev,
      messages: [...prev.messages, newMessage],
      lastUpdated: Date.now(),
      totalQuestions: prev.totalQuestions + 1,
    }));

    setChatAnalysisQuery("");
    setIsChatAnalysisLoading(true);

    try {
      let requestBody: any = {
        query: trimmedQuery,
      };

      // If it's a contact-specific query, fetch fresh messages and include chat history
      if (isContactSpecific && selectedChat) {
        try {
          // Fetch fresh messages for the selected contact
          const response = await axios.get(`http://localhost:8081/api/messages?chatId=${selectedChat.id}`);
          const rawMessages = response.data;
          
          // Parse messages similar to fetchMessages function
          const parsedMessages = rawMessages.map((msg: any, index: number) => {
            const rawContent = msg.body || msg.content || msg.text || msg.message || msg.data || '';
            const parsed = parseMessageContent(rawContent);
            let finalContent = parsed.text || rawContent;
            
            // Additional fallback for content extraction
            if (!finalContent || finalContent.trim().length === 0) {
              const contentFields = ['body', 'content', 'text', 'message', 'data', 'caption'];
              for (const field of contentFields) {
                if (msg[field] && typeof msg[field] === 'string' && msg[field].trim().length > 0) {
                  // Filter out phone numbers
                  if (!msg[field].match(/@s\.whatsapp\.net/)) {
                    finalContent = msg[field].trim();
                    break;
                  }
                }
              }
            }
            
            const senderId = msg.sender || msg.from || msg.name || '';
            const isFromMe = msg.fromMe === true || 
                            msg.fromMe === 'true' || 
                            senderId === 'You' || 
                            msg.sender === 'You' || 
                            msg.from === 'You' ||
                            senderId === currentUserJID ||
                            msg.sender === currentUserJID;
            
            const sender = isFromMe ? 'You' : (senderId || 'Unknown');
            
            return {
              id: msg.id || `msg-${index}-${Date.now()}`,
              content: finalContent,
              sender: sender,
              fromMe: isFromMe,
              timestamp: parsed.timestamp || msg.timestamp || msg.time || new Date().toISOString(),
            };
          });
          
          // Filter out empty messages
          const filteredMessages = parsedMessages.filter((msg: any) => {
            return msg.content && 
                   msg.content.trim().length > 0 && 
                   msg.content !== 'No content' &&
                   msg.content !== 'null' &&
                   msg.content !== 'undefined' &&
                   !msg.content.match(/^\s*$/) &&
                   msg.content.length > 1;
          });
          
          // Format chat history for analysis
          if (filteredMessages.length > 0) {
            const chatHistory = formatMessagesForGemini(filteredMessages);
            requestBody.chat_data = chatHistory;
          }
        } catch (error) {
          console.error('Failed to fetch messages for chat analysis:', error);
        }
      }

      const response = await axios.post("http://localhost:8000/api/chat", requestBody);
      
      updateChatAnalysisConversation(selectedChat.id, prev => ({
        ...prev,
        messages: prev.messages.map(msg =>
          msg.id === newMessage.id
            ? {
                ...msg,
                answer: response.data.answer,
                status: 'complete',
              }
            : msg
        ),
      }));

      // Scroll to bottom with smooth animation
      requestAnimationFrame(() => {
        if (chatAnalysisMessagesContainerRef.current) {
          chatAnalysisMessagesContainerRef.current.scrollTo({
            top: chatAnalysisMessagesContainerRef.current.scrollHeight,
            behavior: 'smooth'
          });
        }
      });
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || error.response?.data?.error || "Failed to get a response. Please try again.";
      
      updateChatAnalysisConversation(selectedChat.id, prev => ({
        ...prev,
        messages: prev.messages.map(msg =>
          msg.id === newMessage.id
            ? {
                ...msg,
                answer: "I encountered an error while processing your question.",
                error: errorMessage,
                status: 'error',
              }
            : msg
        ),
        errorCount: prev.errorCount + 1,
      }));
      
      setChatAnalysisError(errorMessage);
    } finally {
      setIsChatAnalysisLoading(false);
    }
  };

  const clearChatAnalysisHistory = () => {
    if (selectedChat) {
      setChatAnalysisConversations(prev => {
        const newConversations = { ...prev };
        delete newConversations[selectedChat.id];
        return newConversations;
      });
    }
  };

  const handleChatAnalysisKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendChatAnalysisQuery();
    }
  };

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

      {/* Info Banner */}
      <div className="bg-blue-50 border-b border-blue-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center space-x-3">
            <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0" />
            <div className="text-sm text-blue-800">
              <span className="font-medium">Note:</span> Due to WhatsApp's API limitations, only messages received after connecting are available. 
              For historical messages, use the <span className="font-medium">Upload WhatsApp Chat</span> feature.
            </div>
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
            className="lg:col-span-1"
          >
            {selectedChat ? (
              <div className="bg-white rounded-lg shadow-sm border">
                <div className="p-4 border-b">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-gray-900">
                      {selectedChat.name}
                    </h2>
                    <button
                      onClick={() => fetchMessages(selectedChat.id)}
                      className="p-2 rounded-full hover:bg-gray-100 transition-colors duration-200"
                      title="Refresh messages"
                    >
                      <RefreshCw className="w-4 h-4 text-gray-600" />
                    </button>
                  </div>
                </div>
                
                <div ref={messagesContainerRef} className="h-96 overflow-y-auto p-4 space-y-3">
                  {isLoadingMessages ? (
                    <div className="flex justify-center items-center h-full">
                      <div className="flex items-center space-x-2 text-gray-500">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Loading messages...</span>
                      </div>
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-500">
                      <MessageSquare className="w-12 h-12 mb-3 text-gray-400" />
                      <p className="text-sm">No messages yet</p>
                      <p className="text-xs text-gray-400 mt-1">Start a conversation!</p>
                    </div>
                  ) : (
        messages.map((message) => {
          return (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${
                message.fromMe ? 'justify-end' : 'justify-start'
              }`}
            >
                        <div className="flex flex-col max-w-[80%]">
                          <div
                            className={`px-4 py-2 rounded-2xl ${
                              message.fromMe
                                ? 'bg-blue-500 text-white rounded-br-md'
                                : 'bg-gray-100 text-gray-900 rounded-bl-md'
                            }`}
                          >
                            <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">
                              {message.content || 'No content'}
                            </p>
                          </div>
                          <p className={`text-xs text-gray-500 mt-1 px-2 ${
                            message.fromMe ? 'text-right' : 'text-left'
                          }`}>
                            {message.formattedTimestamp || message.timestamp}
            </p>
          </div>
        </motion.div>
        );
      })
                  )}
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

          {/* Chat Analysis Section */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="lg:col-span-1"
          >
            <div className="bg-white rounded-lg shadow-sm border">
              <div className="p-4 border-b">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                      <Bot className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900">
                        Chat Analysis
                        {selectedChat && `: ${selectedChat.name}`}
                      </h2>
                      {selectedChat && getCurrentChatAnalysisConversation().totalQuestions > 0 && (
                        <div className="text-sm text-gray-500 flex items-center space-x-2">
                          <span>{getCurrentChatAnalysisConversation().totalQuestions} questions asked</span>
                          {getCurrentChatAnalysisConversation().errorCount > 0 && (
                            <span className="text-red-500">({getCurrentChatAnalysisConversation().errorCount} errors)</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  {getCurrentChatAnalysisConversation().messages.length > 0 && (
                    <button
                      onClick={clearChatAnalysisHistory}
                      className="p-2 rounded-full hover:bg-gray-100 transition-colors duration-200"
                      title="Clear history"
                    >
                      <Trash2 className="w-4 h-4 text-gray-600" />
                    </button>
                  )}
                </div>
              </div>

              {chatAnalysisError && (
                <div className="px-4 py-2 bg-red-50 border-b border-red-100">
                  <p className="text-sm text-red-600 flex items-center">
                    <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0" />
                    {chatAnalysisError}
                  </p>
                </div>
              )}

              <div 
                ref={chatAnalysisMessagesContainerRef}
                className="h-96 overflow-y-auto p-4 bg-gray-50"
              >
                {selectedChat ? (
                  <>
                    {getCurrentChatAnalysisConversation().messages.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-gray-500">
                        <Bot className="w-12 h-12 mb-3 text-gray-400" />
                        <p className="text-sm text-center">
                          Ask questions about this chat or anything else!
                        </p>
                        <p className="text-xs text-gray-400 mt-1 text-center">
                          Try: "What did we discuss yesterday?" or "How's the weather?"
                        </p>
                      </div>
                    ) : (
                      getCurrentChatAnalysisConversation().messages.map((msg) => (
                        <div key={msg.id} className="mb-4">
                          <div className="flex flex-col space-y-2">
                            <div className="flex justify-end">
                              <div className="max-w-[85%] bg-green-50 rounded-lg px-3 py-2 shadow-sm">
                                <p className="text-sm text-gray-800">{msg.question}</p>
                                <div className="flex items-center justify-between mt-1">
                                  <p className="text-xs text-gray-500">
                                    {msg.isContactSpecific ? "Chat-specific" : "General"}
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    {new Date(msg.timestamp).toLocaleTimeString([], {
                                      hour: "2-digit",
                                      minute: "2-digit"
                                    })}
                                  </p>
                                </div>
                              </div>
                            </div>
                            {msg.status === 'complete' && (
                              <div className="flex justify-start">
                                <div className="max-w-[85%] bg-white rounded-lg px-3 py-2 shadow-sm">
                                  <p className="text-sm text-gray-800 whitespace-pre-wrap">{msg.answer}</p>
                                  <p className="text-xs text-gray-500 text-right mt-1">
                                    {new Date(msg.timestamp).toLocaleTimeString([], {
                                      hour: "2-digit",
                                      minute: "2-digit"
                                    })}
                                  </p>
                                </div>
                              </div>
                            )}
                            {msg.status === 'pending' && (
                              <div className="flex justify-start">
                                <div className="max-w-[85%] bg-white rounded-lg px-3 py-2 shadow-sm">
                                  <div className="flex items-center space-x-1">
                                    <div className="animate-pulse flex space-x-1">
                                      <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                                      <div className="h-2 w-2 bg-green-500 rounded-full animation-delay-200"></div>
                                      <div className="h-2 w-2 bg-green-500 rounded-full animation-delay-400"></div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                            {msg.status === 'error' && (
                              <div className="flex justify-start">
                                <div className="max-w-[85%] bg-red-50 rounded-lg px-3 py-2 shadow-sm">
                                  <p className="text-sm text-red-600">{msg.error}</p>
                                  <p className="text-xs text-red-500 text-right mt-1">
                                    {new Date(msg.timestamp).toLocaleTimeString([], {
                                      hour: "2-digit",
                                      minute: "2-digit"
                                    })}
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-gray-500">
                    <Bot className="w-16 h-16 mb-4 text-gray-400" />
                    <p className="text-lg font-light">Please select a contact to start chat analysis</p>
                  </div>
                )}
              </div>

              <div className="p-3 bg-white border-t border-gray-200">
                <div className="flex items-center space-x-2 bg-gray-50 px-4 py-3 rounded-lg">
                  <div className="flex-1">
                    <textarea
                      value={chatAnalysisQuery}
                      onChange={(e) => setChatAnalysisQuery(e.target.value)}
                      onKeyPress={handleChatAnalysisKeyPress}
                      placeholder="Ask about this chat or anything else..."
                      disabled={!selectedChat || isChatAnalysisLoading}
                      className={`w-full bg-transparent text-gray-800 placeholder-gray-500 resize-none focus:outline-none min-h-[24px] max-h-[100px] text-sm ${
                        !selectedChat ? "cursor-not-allowed" : ""
                      }`}
                      rows={1}
                    />
                  </div>
                  {!chatAnalysisQuery.trim() ? (
                    <button 
                      className="p-2 rounded-full hover:bg-gray-100 transition-colors duration-200"
                      disabled={!selectedChat}
                    >
                      <MessageSquare className="w-4 h-4 text-gray-600" />
                    </button>
                  ) : (
                    <button
                      onClick={sendChatAnalysisQuery}
                      disabled={!selectedChat || isChatAnalysisLoading || !chatAnalysisQuery.trim()}
                      className={`p-2 rounded-full transition-colors duration-200 ${
                        !selectedChat || isChatAnalysisLoading
                          ? "bg-gray-200 cursor-not-allowed"
                          : "bg-green-600 hover:bg-green-700 text-white"
                      }`}
                    >
                      {isChatAnalysisLoading ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
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