import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import QRCodeStyling from "qr-code-styling";
import { debounce } from 'lodash';

interface APIMessage {
  key: {
    remoteJid: string;
    fromMe: boolean;
    id: string;
  };
  message: {
    conversation?: string;
    extendedTextMessage?: {
      text: string;
    };
  };
  messageTimestamp: number;
  status?: 'sent' | 'delivered' | 'read';
}

interface Message {
  id: string;
  fromMe: boolean;
  timestamp: number;
  text: string;
  status?: 'sent' | 'delivered' | 'read';
  remoteJid?: string;
}

interface Chat {
  jid: string;
  name: string;
  lastMessage?: string;
  timestamp: string;
  timestampDate: Date;
  unreadCount: number;
  messages: Message[];
}

interface ChatHistory {
  [jid: string]: Message[];
}

// QR Code styling options type
interface QROptions {
  width: number;
  height: number;
  type: string;
  data: string;
  dotsOptions: {
    color: string;
    type: string;
  };
  backgroundOptions: {
    color: string;
  };
}

interface ChatData {
  name?: string;
  timestamp: string;
}

// Add new types for enhanced AI features
interface AIMessageMetadata {
  processingTime: number;
  confidence: number;
  relevantDates: string[];
}

interface AIMessage {
  id: string;
  question: string;
  answer: string;
  timestamp: number;
  error?: string;
  contextSize?: number;
  status: 'pending' | 'complete' | 'error';
  metadata?: AIMessageMetadata;
}

interface AIConversationState {
  messages: AIMessage[];
  lastUpdated: number;
  totalQuestions: number;
  errorCount: number;
}

const WhatsAppWebPage = () => {
  const [qr, setQr] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChat, setSelectedChat] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMsg, setNewMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatHistory>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [autoScroll, setAutoScroll] = useState(true);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const lastScrollPositionRef = useRef(0);
  const previousMessagesLengthRef = useRef(0);
  const qrRef = useRef<HTMLDivElement>(null);
  const qrCode = useRef<QRCodeStyling | null>(null);
  const [aiConversations, setAiConversations] = useState<Record<string, AIConversationState>>({});
  const [aiQuery, setAiQuery] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const aiMessagesContainerRef = useRef<HTMLDivElement>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const queryStartTime = useRef<number | null>(null);

  // Initialize QR code instance
  useEffect(() => {
    const qrOptions: QROptions = {
      width: 264,
      height: 264,
      type: "canvas",
      data: "Initializing...",
      dotsOptions: {
        color: "#000000",
        type: "square"
      },
      backgroundOptions: {
        color: "#ffffff"
      }
    };
    
    qrCode.current = new QRCodeStyling(qrOptions);
  }, []);

  // Update QR code when qr state changes
  useEffect(() => {
    if (qr && qrCode.current && qrRef.current) {
      // Clear previous QR code
      while (qrRef.current.firstChild) {
        qrRef.current.removeChild(qrRef.current.firstChild);
      }
      
      // Update and append new QR code
      qrCode.current.update({
        data: qr
      });
      qrCode.current.append(qrRef.current);
    }
  }, [qr]);

  // Step 1: Fetch QR and start polling for status
  useEffect(() => {
    const fetchQR = async () => {
      try {
        console.log("Attempting to fetch QR code...");
        const res = await axios.get("http://localhost:8000/api/mcp/qr");
        console.log("QR code response:", res.data);
        if (res.data.qr) {
          setQr(res.data.qr);
        }
      } catch (error: any) {
        console.error("Failed to fetch QR:", error.response?.data || error);
      }
    };

    const checkStatus = async () => {
      try {
        console.log("Checking connection status...");
        const res = await axios.get("http://localhost:8000/api/mcp/status");
        console.log("Status response:", res.data);
        if (res.data.connected === true) {
          setConnected(true);
          setQr(null); // Clear QR when connected
          console.log("WhatsApp client connected!");
        } else {
          console.log("WhatsApp client not connected, fetching QR...");
          setConnected(false);
          // Fetch QR if not connected
          fetchQR();
        }
      } catch (error: any) {
        console.error("Failed to check status:", error.response?.data || error);
        setConnected(false);
        // Try to fetch QR on status check failure
        fetchQR();
      }
    };

    // Initial status check and QR fetch
    checkStatus();

    // Set up polling intervals with shorter times for more responsive updates
    const statusInterval = setInterval(checkStatus, 2000); // Check status every 2 seconds
    const qrInterval = setInterval(fetchQR, 10000); // Refresh QR every 10 seconds

    return () => {
      clearInterval(statusInterval);
      clearInterval(qrInterval);
    };
  }, []);

  const scrollToBottom = () => {
    if (messagesContainerRef.current && autoScroll) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  };

  // Handle scroll events to detect if user has scrolled up
  const handleScroll = () => {
    if (!messagesContainerRef.current) return;
    
    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
    const isNearBottom = scrollHeight - (scrollTop + clientHeight) < 100;
    
    setAutoScroll(isNearBottom);
    lastScrollPositionRef.current = scrollTop;
  };

  // Add effect to scroll to bottom only for new messages
  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom();
    }
  }, [messages.length]);

  // Load chat history from localStorage on component mount
  useEffect(() => {
    const loadChatHistory = () => {
      const savedHistory = localStorage.getItem('whatsapp_chat_history');
      if (savedHistory) {
        try {
          setChatHistory(JSON.parse(savedHistory));
        } catch (error) {
          console.error('Failed to load chat history:', error);
        }
      }
    };
    loadChatHistory();
  }, []);

  // Save chat history to localStorage whenever it changes
  useEffect(() => {
    if (Object.keys(chatHistory).length > 0) {
      localStorage.setItem('whatsapp_chat_history', JSON.stringify(chatHistory));
    }
  }, [chatHistory]);

  // Enhanced persistence with version control
  useEffect(() => {
    const loadAiConversations = () => {
      const savedData = localStorage.getItem('whatsapp_ai_conversations_v2');
      if (savedData) {
        try {
          const parsed = JSON.parse(savedData);
          // Validate data structure
          if (typeof parsed === 'object' && parsed !== null) {
            setAiConversations(parsed);
          }
        } catch (error) {
          console.error('Failed to load AI conversations:', error);
          // Attempt to migrate old format if exists
          const oldData = localStorage.getItem('whatsapp_ai_messages');
          if (oldData) {
            try {
              const oldMessages = JSON.parse(oldData);
              const migratedData = Object.entries(oldMessages).reduce<Record<string, AIConversationState>>((acc, [jid, messages]) => ({
                ...acc,
                [jid]: {
                  messages: (messages as AIMessage[]),
                  lastUpdated: Date.now(),
                  totalQuestions: (messages as AIMessage[]).length,
                  errorCount: (messages as AIMessage[]).filter((m: AIMessage) => m.error).length,
                },
              }), {});
              setAiConversations(migratedData);
              localStorage.setItem('whatsapp_ai_conversations_v2', JSON.stringify(migratedData));
            } catch (e) {
              console.error('Failed to migrate old AI messages:', e);
            }
          }
        }
      }
    };

    loadAiConversations();
  }, []);

  // Debounced save to localStorage
  const saveAiConversations = debounce((conversations: Record<string, AIConversationState>) => {
    localStorage.setItem('whatsapp_ai_conversations_v2', JSON.stringify(conversations));
  }, 1000);

  useEffect(() => {
    if (Object.keys(aiConversations).length > 0) {
      saveAiConversations(aiConversations);
    }
  }, [aiConversations]);

  // Reset error state when changing chats
  useEffect(() => {
    setAiError(null);
  }, [selectedChat]);

  const updateAiConversation = (
    jid: string,
    updater: (prev: AIConversationState) => AIConversationState
  ) => {
    setAiConversations(prev => ({
      ...prev,
      [jid]: updater(prev[jid] || {
        messages: [],
        lastUpdated: Date.now(),
        totalQuestions: 0,
        errorCount: 0,
      }),
    }));
  };

  // Add new helper functions for AI features
  const formatProcessingTime = (ms: number): string => {
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const formatConfidence = (confidence: number): string => {
    return `${(confidence * 100).toFixed(1)}%`;
  };

  // Enhance the AI query function
  const sendAiQuery = async () => {
    if (!selectedChat || !aiQuery.trim()) return;

    const trimmedQuery = aiQuery.trim();
    queryStartTime.current = Date.now();
    
    const newMessage: AIMessage = {
      id: `ai-${Date.now()}`,
      question: trimmedQuery,
      answer: "",
      timestamp: Date.now(),
      status: 'pending',
    };

    setAiError(null);
    updateAiConversation(selectedChat, prev => ({
      ...prev,
      messages: [...prev.messages, newMessage],
      lastUpdated: Date.now(),
      totalQuestions: prev.totalQuestions + 1,
    }));

    setAiQuery("");
    setIsAiLoading(true);

    try {
      const response = await axios.post("http://localhost:8000/api/query-llm", {
        jid: selectedChat,
        question: trimmedQuery,
      });

      const processingTime = Date.now() - (queryStartTime.current || Date.now());
      
      updateAiConversation(selectedChat, prev => ({
        ...prev,
        messages: prev.messages.map(msg =>
          msg.id === newMessage.id
            ? {
                ...msg,
                answer: response.data.answer,
                contextSize: response.data.context_length,
                status: 'complete',
                metadata: {
                  processingTime,
                  confidence: response.data.confidence,
                  relevantDates: response.data.relevant_dates,
                },
              }
            : msg
        ),
      }));

      // Scroll to bottom with smooth animation
      requestAnimationFrame(() => {
        if (aiMessagesContainerRef.current) {
          aiMessagesContainerRef.current.scrollTo({
            top: aiMessagesContainerRef.current.scrollHeight,
            behavior: 'smooth'
          });
        }
      });
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || error.response?.data?.error || "Failed to get a response. Please try again.";
      
      updateAiConversation(selectedChat, prev => ({
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
      
      setAiError(errorMessage);
    } finally {
      setIsAiLoading(false);
    }
  };

  const clearAiHistory = () => {
    if (selectedChat) {
      setAiConversations(prev => {
        const newConversations = { ...prev };
        delete newConversations[selectedChat];
        return newConversations;
      });
    }
  };

  // Get current chat's AI conversation state
  const currentAiConversation = selectedChat ? aiConversations[selectedChat] || {
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

  // Format timestamp for chat list
  const formatTimestamp = (timestamp: string | Date): string => {
    try {
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) {
        return '';
      }
      
      const now = new Date();
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      
      // If timestamp is today
      if (date.toDateString() === now.toDateString()) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
      
      // If timestamp is yesterday
      if (date.toDateString() === yesterday.toDateString()) {
        return 'Yesterday';
      }
      
      // If timestamp is this year
      if (date.getFullYear() === now.getFullYear()) {
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
      }
      
      // If timestamp is before this year
      return date.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
    } catch (error) {
      console.error('Error formatting timestamp:', error);
      return '';
    }
  };

  // Convert WhatsApp message format to our format
  const convertMessage = (apiMsg: APIMessage): Message => {
    return {
      id: apiMsg.key.id,
      fromMe: apiMsg.key.fromMe,
      timestamp: apiMsg.messageTimestamp * 1000, // Convert to milliseconds
      text: apiMsg.message.conversation || apiMsg.message.extendedTextMessage?.text || '',
      status: apiMsg.status || 'delivered',
      remoteJid: apiMsg.key.remoteJid
    };
  };

  // Update message fetching with scroll position preservation
  useEffect(() => {
    if (selectedChat && connected) {
      const fetchMessages = async () => {
        try {
          console.log("Fetching messages for chat:", selectedChat);
          const res = await axios.get(`http://localhost:8000/api/mcp/messages?chatId=${selectedChat}`);
          console.log("Raw API response:", res.data);
          
          // Keep existing messages if API returns null
          if (!res.data.messages) {
            console.log("No messages returned from API, keeping existing messages");
            return;
          }

          // Store current scroll position and messages length before update
          const currentScrollTop = messagesContainerRef.current?.scrollTop || 0;
          const currentScrollHeight = messagesContainerRef.current?.scrollHeight || 0;
          const prevLength = previousMessagesLengthRef.current;

          const apiMessages = (res.data.messages || [])
            .map((msg: any) => {
              console.log("Processing message:", msg);
              return {
                id: `${msg.Time || Date.now()}-${Math.random()}`,
                fromMe: msg.IsFromMe || false,
                timestamp: msg.Time ? new Date(msg.Time).getTime() : Date.now(),
                text: msg.Content || '',
                status: 'delivered' as const
              };
            })
            .filter((msg: Message) => msg.text.trim() !== ''); // Filter out empty messages

          // Sort messages by timestamp
          const sortedApiMessages = apiMessages.sort((a: Message, b: Message) => a.timestamp - b.timestamp);

          console.log("Processed API messages:", sortedApiMessages);

          // Merge with existing messages
          setMessages(prev => {
            // Get messages from the last 5 minutes
            const recentTimestamp = Date.now() - 5 * 60 * 1000;
            const recentLocalMessages = prev.filter(msg => msg.timestamp > recentTimestamp);
            
            // Combine API messages with recent local messages
            const combinedMessages = [...sortedApiMessages];
            
            // Add recent local messages that aren't in the API response
            recentLocalMessages.forEach(localMsg => {
              if (!combinedMessages.some(apiMsg => 
                apiMsg.text === localMsg.text && 
                Math.abs(apiMsg.timestamp - localMsg.timestamp) < 1000
              )) {
                combinedMessages.push(localMsg);
              }
            });

            // Sort final combined messages
            const sortedMessages = combinedMessages.sort((a, b) => a.timestamp - b.timestamp);
            console.log("Final merged messages:", sortedMessages);
            return sortedMessages;
          });

          // Update chat history with merged messages
          setChatHistory(prev => {
            const existingMessages = prev[selectedChat] || [];
            const recentTimestamp = Date.now() - 5 * 60 * 1000;
            const recentLocalMessages = existingMessages.filter(msg => msg.timestamp > recentTimestamp);

            const combinedMessages = [...sortedApiMessages];
            recentLocalMessages.forEach(localMsg => {
              if (!combinedMessages.some(apiMsg => 
                apiMsg.text === localMsg.text && 
                Math.abs(apiMsg.timestamp - localMsg.timestamp) < 1000
              )) {
                combinedMessages.push(localMsg);
              }
            });

            const sortedMessages = combinedMessages.sort((a, b) => a.timestamp - b.timestamp);
            return {
              ...prev,
              [selectedChat]: sortedMessages
            };
          });

          // After state update, handle scrolling
          requestAnimationFrame(() => {
            if (!messagesContainerRef.current) return;

            if (loading) {
              // Initial load - scroll to bottom
              scrollToBottom();
            } else if (sortedApiMessages.length !== prevLength) {
              // New messages arrived - maintain relative scroll position
              const newScrollHeight = messagesContainerRef.current.scrollHeight;
              const heightDiff = newScrollHeight - currentScrollHeight;
              messagesContainerRef.current.scrollTop = currentScrollTop + heightDiff;
            } else {
              // No new messages - restore exact scroll position
              messagesContainerRef.current.scrollTop = currentScrollTop;
            }
          });
        } catch (error) {
          console.error("Failed to fetch messages:", error);
        } finally {
          if (loading) setLoading(false);
        }
      };

      // Initial fetch
      fetchMessages();

      // Set up polling every 2 seconds
      const pollInterval = setInterval(fetchMessages, 2000);

      return () => clearInterval(pollInterval);
    }
  }, [selectedChat, connected]);

  // Update chat list fetching
  useEffect(() => {
    if (connected) {
      const fetchChats = async () => {
        try {
          console.log("Fetching chats...");
          const res = await axios.get<Record<string, ChatData | string>>("http://localhost:8000/api/mcp/chats");
          console.log("Received chats response:", res.data);
          
          if (!res.data || Object.keys(res.data).length === 0) {
            console.log("No chats available");
            setChats([]);
            return;
          }
          
          const formattedChats = Object.entries(res.data).map(([jid, data]) => {
            console.log("Processing chat:", { jid, data });
            const existingMessages = chatHistory[jid] || [];
            const lastMessage = existingMessages[existingMessages.length - 1];
            
            // Extract name from data if it's an object with a name field
            let name = jid;
            if (typeof data === 'object' && data !== null && 'name' in data) {
              name = data.name || formatJID(jid);
            } else {
              name = formatJID(jid);
            }
            
            const timestamp = typeof data === 'object' && data !== null ? data.timestamp : data;
            
            return {
              jid,
              name: name,
              timestamp: new Date(timestamp).toLocaleString(),
              timestampDate: new Date(timestamp),
              unreadCount: 0,
              messages: existingMessages,
              lastMessage: lastMessage?.text
            };
          }).sort((a, b) => b.timestampDate.getTime() - a.timestampDate.getTime());
          
          console.log("Formatted chats:", formattedChats);
          setChats(formattedChats);
        } catch (error: any) {
          console.error("Failed to fetch chats:", error.response?.data || error);
        }
      };

      // Initial fetch
      fetchChats();

      // Set up polling every 3 seconds
      const pollInterval = setInterval(fetchChats, 3000);

      return () => clearInterval(pollInterval);
    } else {
      // Clear chats when disconnected
      setChats([]);
    }
  }, [connected, chatHistory]);

  const formatJID = (jid: string): string => {
    // Remove @s.whatsapp.net and format phone number
    return jid.replace("@s.whatsapp.net", "").replace(/(\d{2})(\d{3})(\d{3})(\d{4})/, "+$1 $2-$3-$4");
  };

  const sendMessage = async () => {
    if (!selectedChat || !newMsg.trim()) {
      console.error("Cannot send message: No chat selected or empty message");
      return;
    }
    
    const messageText = newMsg.trim();
    const newMessage: Message = {
      id: `${Date.now()}-${Math.random()}`,
      fromMe: true,
      timestamp: Date.now(),
      text: messageText,
      status: 'sent',
      remoteJid: selectedChat
    };
    
    try {
      const recipient = selectedChat.split('@')[0].replace(/[^0-9]/g, "");
      
      // Clear input immediately
      setNewMsg("");

      // Optimistically add message to UI and chat history
      setMessages(prev => [...prev, newMessage]);
      setChatHistory(prev => ({
        ...prev,
        [selectedChat]: [...(prev[selectedChat] || []), newMessage]
      }));

      // Update chat list
      setChats(prevChats => 
        prevChats.map(chat => 
          chat.jid === selectedChat 
            ? {
                ...chat,
                lastMessage: messageText,
                timestamp: formatTimestamp(new Date()),
                timestampDate: new Date(),
                messages: [...chat.messages, newMessage]
              }
            : chat
        ).sort((a, b) => b.timestampDate.getTime() - a.timestampDate.getTime())
      );

      // Force scroll to bottom after adding new message
      requestAnimationFrame(() => {
        if (messagesContainerRef.current) {
          messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
        }
      });
      
      // Send message to API
      const response = await axios.post("http://localhost:8080/api/send", {
        recipient,
        message: messageText
      });

      if (!response.data.success) {
        throw new Error(response.data.message || "Failed to send message");
      }

      // Update message status to delivered
      setMessages(prev => 
        prev.map(msg => 
          msg.id === newMessage.id 
            ? { ...msg, status: 'delivered' } 
            : msg
        )
      );

      // Update chat history with delivered status
      setChatHistory(prev => ({
        ...prev,
        [selectedChat]: prev[selectedChat].map(msg =>
          msg.id === newMessage.id
            ? { ...msg, status: 'delivered' }
            : msg
        )
      }));

    } catch (error: any) {
      console.error("Failed to send message:", error);
      const errorMessage = error.response?.data?.message || error.message || "Failed to send message";
      alert(`Error: ${errorMessage}. Please try again.`);
      
      // Remove failed message from UI and history
      setMessages(prev => prev.filter(msg => msg.id !== newMessage.id));
      setChatHistory(prev => ({
        ...prev,
        [selectedChat]: prev[selectedChat].filter(msg => msg.id !== newMessage.id)
      }));
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const filteredChats = chats.filter(chat => 
    chat.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAiKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendAiQuery();
    }
  };

  return (
    <div className="flex h-screen bg-[#f0f2f5]">
      {/* Left Panel - Chat List */}
      <div className="w-1/4 flex flex-col border-r border-gray-200">
        {/* Header */}
        <div className="p-4 bg-[#f0f2f5]">
          <div className="flex items-center space-x-4 mb-4">
            <div className="w-10 h-10 rounded-full bg-gray-300"></div>
            <div className="flex-1">
              <h2 className="text-gray-800 font-medium">WhatsApp Web</h2>
            </div>
          </div>
          {/* Search Bar */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search or start new chat"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white text-gray-800 placeholder-gray-500 px-4 py-2 rounded-lg focus:outline-none border border-gray-200"
            />
          </div>
        </div>

        {/* Chat List */}
        <div className="flex-1 overflow-y-auto bg-white">
          {!connected && <p className="text-gray-600 p-4">Waiting for connection...</p>}
          {connected && (
            <div className="space-y-1">
              {filteredChats.map((chat) => (
                <button
                  key={chat.jid}
                  onClick={() => setSelectedChat(chat.jid)}
                  className={`w-full text-left p-3 hover:bg-gray-100 flex items-center space-x-3
                    ${selectedChat === chat.jid ? "bg-[#f0f2f5]" : ""}`}
                >
                  <div className="w-12 h-12 rounded-full bg-gray-300 flex-shrink-0"></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between">
                      <span className="text-gray-800 font-medium truncate">{chat.name}</span>
                      <span className="text-xs text-gray-500">{chat.timestamp || ''}</span>
                    </div>
                    {chat.lastMessage && (
                      <p className="text-gray-600 text-sm truncate">{chat.lastMessage}</p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Middle Panel - Chat Window */}
      <div className="w-1/2 flex flex-col bg-[#f8f9fa]">
        {!connected ? (
          <div className="flex flex-col items-center justify-center flex-grow bg-white p-8">
            <div className="bg-white p-4 rounded-lg shadow-lg">
              <h1 className="text-2xl font-bold mb-6 text-center text-gray-800">To use WhatsApp on your computer:</h1>
              <ol className="list-decimal list-inside space-y-4 mb-8 text-gray-700">
                <li>Open WhatsApp on your phone</li>
                <li>Tap Menu or Settings and select WhatsApp Web</li>
                <li>Point your phone to this screen to capture the QR code</li>
              </ol>
              <div ref={qrRef} className="inline-block bg-white p-4 rounded-lg shadow-lg"></div>
              {qr && <div className="mt-2 text-sm text-gray-500">QR Code Length: {qr.length}</div>}
            </div>
          </div>
        ) : selectedChat ? (
          <>
            {/* Chat Header */}
            <div className="p-4 bg-[#f0f2f5] flex items-center space-x-4 border-b border-gray-200">
              <div className="w-10 h-10 rounded-full bg-gray-300"></div>
              <div className="flex-1">
                <h2 className="text-gray-800 font-medium">{formatJID(selectedChat)}</h2>
                <p className="text-sm text-gray-600">online</p>
              </div>
            </div>

            {/* Messages Area */}
            <div 
              className="flex-1 overflow-y-auto p-4 bg-[#efeae2]" 
              ref={messagesContainerRef}
              onScroll={handleScroll}
            >
              {loading ? (
                <div className="flex justify-center items-center h-full">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-600"></div>
                </div>
              ) : (
                <div className="space-y-2">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.fromMe ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[70%] rounded-lg p-3 ${
                          msg.fromMe ? "bg-[#d9fdd3]" : "bg-white"
                        }`}
                      >
                        <p className="text-gray-800 whitespace-pre-wrap break-words">
                          {msg.text}
                        </p>
                        <div className="flex items-center justify-end gap-1 mt-1">
                          <p className="text-gray-500 text-xs">
                            {new Date(msg.timestamp).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit"
                            })}
                          </p>
                          {msg.fromMe && (
                            <span className="text-xs text-gray-500">
                              {msg.status === 'sent' && (
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3">
                                  <path fillRule="evenodd" d="M3.97 3.97a.75.75 0 011.06 0l13.72 13.72V8.25a.75.75 0 011.5 0V19.5a.75.75 0 01-.75.75H8.25a.75.75 0 010-1.5h9.44L3.97 5.03a.75.75 0 010-1.06z" clipRule="evenodd" />
                                </svg>
                              )}
                              {msg.status === 'delivered' && (
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3">
                                  <path fillRule="evenodd" d="M4.72 3.97a.75.75 0 011.06 0l7.5 7.5a.75.75 0 010 1.06l-7.5 7.5a.75.75 0 01-1.06-1.06L11.69 12 4.72 5.03a.75.75 0 010-1.06zm6 0a.75.75 0 011.06 0l7.5 7.5a.75.75 0 010 1.06l-7.5 7.5a.75.75 0 11-1.06-1.06L17.69 12l-6.97-6.97a.75.75 0 010-1.06z" clipRule="evenodd" />
                                </svg>
                              )}
                              {msg.status === 'read' && (
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#34b7f1" className="w-3 h-3">
                                  <path fillRule="evenodd" d="M4.72 3.97a.75.75 0 011.06 0l7.5 7.5a.75.75 0 010 1.06l-7.5 7.5a.75.75 0 01-1.06-1.06L11.69 12 4.72 5.03a.75.75 0 010-1.06zm6 0a.75.75 0 011.06 0l7.5 7.5a.75.75 0 010 1.06l-7.5 7.5a.75.75 0 11-1.06-1.06L17.69 12l-6.97-6.97a.75.75 0 010-1.06z" clipRule="evenodd" />
                                </svg>
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Message Input */}
            <div className="p-4 bg-[#f0f2f5]">
              <div className="flex items-center space-x-4">
                <textarea
                  value={newMsg}
                  onChange={(e) => setNewMsg(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Type a message"
                  className="flex-1 bg-white text-gray-800 placeholder-gray-500 px-4 py-2 rounded-lg resize-none focus:outline-none border border-gray-200"
                  rows={1}
                />
                <button
                  onClick={() => {
                    console.log("Send button clicked");
                    console.log("Selected chat:", selectedChat);
                    console.log("Message:", newMsg);
                    if (newMsg.trim()) {
                      sendMessage();
                    }
                  }}
                  disabled={!newMsg.trim() || !selectedChat}
                  className={`p-2 rounded-full ${
                    newMsg.trim() && selectedChat ? "bg-[#00a884] hover:bg-[#00916e]" : "bg-gray-200"
                  }`}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className={`w-6 h-6 ${newMsg.trim() && selectedChat ? "text-white" : "text-gray-400"}`}
                  >
                    <path d="M3.478 2.404a.75.75 0 011.06 0l13.72 13.72V8.25a.75.75 0 011.5 0V19.5a.75.75 0 01-.75.75H8.25a.75.75 0 010-1.5h9.44L3.97 5.03a.75.75 0 010-1.06z" />
                  </svg>
                </button>
              </div>
            </div>
          </>
        ) : connected ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="w-16 h-16 mb-4"
            >
              <path d="M4.913 2.658c2.075-.27 4.19-.408 6.337-.408 2.147 0 4.262.139 6.337.408 1.922.25 3.291 1.861 3.405 3.727a4.403 4.403 0 0 0-1.032-.211 50.89 50.89 0 0 0-8.42 0c-2.358.196-4.04 2.19-4.04 4.434v4.286a4.47 4.47 0 0 0 2.433 3.984L7.28 21.53A.75.75 0 0 1 6 21v-4.03a48.527 48.527 0 0 1-1.087-.128C2.905 16.58 1.5 14.833 1.5 12.862V6.638c0-1.97 1.405-3.718 3.413-3.979Z" />
              <path d="M15.75 7.5c-1.376 0-2.739.057-4.086.169C10.124 7.797 9 9.103 9 10.609v4.285c0 1.507 1.128 2.814 2.67 2.94 1.243.102 2.5.157 3.768.165l2.782 2.781a.75.75 0 0 0 1.28-.53v-2.39l.33-.026c1.542-.125 2.67-1.433 2.67-2.94v-4.286c0-1.505-1.125-2.811-2.664-2.94A49.392 49.392 0 0 0 15.75 7.5Z" />
            </svg>
            <p className="text-xl font-light">Select a chat to start messaging</p>
          </div>
        ) : (
          <div className="flex justify-center items-center h-full text-gray-500">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-600"></div>
          </div>
        )}
      </div>

      {/* Right Panel - AI Assistant */}
      <div className="w-1/4 flex flex-col bg-white border-l border-gray-200">
        <div className="p-4 bg-[#f0f2f5] border-b border-gray-200 flex justify-between items-center">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">AI Assistant</h2>
            {selectedChat && currentAiConversation.totalQuestions > 0 && (
              <div className="text-sm text-gray-600 flex items-center space-x-2">
                <span>{currentAiConversation.totalQuestions} questions asked</span>
                {currentAiConversation.errorCount > 0 && (
                  <span className="text-red-500">({currentAiConversation.errorCount} errors)</span>
                )}
              </div>
            )}
          </div>
          {currentAiConversation.messages.length > 0 && (
            <button
              onClick={clearAiHistory}
              className="text-gray-500 hover:text-gray-700 transition-colors duration-200"
              title="Clear history"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </button>
          )}
        </div>

        {aiError && (
          <div className="px-4 py-2 bg-red-50 border-b border-red-100 animate-fade-in">
            <p className="text-sm text-red-600 flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              {aiError}
            </p>
          </div>
        )}

        <div 
          ref={aiMessagesContainerRef}
          className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50"
        >
          {!selectedChat ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              <p>Select a chat to start asking questions</p>
            </div>
          ) : currentAiConversation.messages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              <div className="text-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-12 w-12 mx-auto mb-4 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                  />
                </svg>
                <p className="text-sm">Ask me anything about this conversation!</p>
                <p className="text-xs text-gray-400 mt-2">I'll analyze the chat history to help you</p>
              </div>
            </div>
          ) : (
            currentAiConversation.messages.map((msg) => (
              <div key={msg.id} className="space-y-2 animate-fade-in">
                <div className="flex justify-end">
                  <div className="bg-blue-100 rounded-lg p-3 max-w-[85%] transform transition-all duration-200 hover:scale-[1.02]">
                    <p className="text-blue-800 whitespace-pre-wrap break-words">
                      {msg.question}
                    </p>
                    <p className="text-xs text-blue-600/70 mt-1">
                      {new Date(msg.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
                <div className="flex justify-start">
                  <div className={`rounded-lg p-3 max-w-[85%] transform transition-all duration-200 hover:scale-[1.02] ${
                    msg.status === 'error' ? 'bg-red-50' : 'bg-gray-100'
                  }`}>
                    {msg.status === 'pending' ? (
                      <div className="flex items-center space-x-2 p-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent"></div>
                        <p className="text-gray-600">Analyzing conversation...</p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-gray-800 whitespace-pre-wrap break-words">
                          {msg.answer}
                        </p>
                        {msg.error && (
                          <div className="mt-2 p-2 bg-red-100 rounded text-sm text-red-600">
                            {msg.error}
                          </div>
                        )}
                        {msg.metadata && (
                          <div className="mt-2 text-xs text-gray-400 space-y-1 border-t border-gray-200 pt-2">
                            <div className="flex items-center justify-between">
                              <span>Response time: {formatProcessingTime(msg.metadata.processingTime)}</span>
                              <span>Confidence: {formatConfidence(msg.metadata.confidence)}</span>
                            </div>
                            {msg.contextSize && (
                              <p>Based on {msg.contextSize} messages</p>
                            )}
                            {msg.metadata.relevantDates && msg.metadata.relevantDates.length > 0 && (
                              <p>Relevant dates: {msg.metadata.relevantDates.join(", ")}</p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-4 bg-white border-t border-gray-200">
          <div className="flex items-center space-x-2">
            <div className="relative flex-1">
              <textarea
                value={aiQuery}
                onChange={(e) => setAiQuery(e.target.value)}
                onKeyPress={handleAiKeyPress}
                placeholder={selectedChat ? "Ask about this conversation..." : "Select a chat first"}
                disabled={!selectedChat || isAiLoading}
                className={`w-full bg-gray-100 text-gray-800 placeholder-gray-500 px-4 py-2 pr-10 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 transition-all duration-200 ${
                  isAiLoading ? 'opacity-50' : ''
                }`}
                rows={1}
              />
              {isAiLoading && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-600 border-t-transparent"></div>
                </div>
              )}
            </div>
            <button
              onClick={sendAiQuery}
              disabled={!selectedChat || !aiQuery.trim() || isAiLoading}
              className={`p-2 rounded-full transition-all duration-200 ${
                selectedChat && aiQuery.trim() && !isAiLoading
                  ? "bg-blue-500 hover:bg-blue-600 text-white transform hover:scale-105"
                  : "bg-gray-200 text-gray-400 cursor-not-allowed"
              }`}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="w-5 h-5"
              >
                <path d="M3.478 2.404a.75.75 0 00-.926.941l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.404z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WhatsAppWebPage;
