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
  phoneNumber: string;
  imageUrl: string;
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

// Chat Analysis specific interfaces
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

interface ContactInfo {
  name: string;
  phoneNumber: string;
  imageUrl: string;
}

const formatPhoneNumber = (phoneNumber: string): string => {
  // Remove any non-numeric characters
  const cleaned = phoneNumber.replace(/\D/g, '');
  
  // Handle different formats
  if (cleaned.length >= 10) {
    const lastTen = cleaned.slice(-10);
    const countryCode = cleaned.slice(0, cleaned.length - 10) || '91';
    return `+${countryCode} ${lastTen.slice(0, 3)}-${lastTen.slice(3, 6)}-${lastTen.slice(6)}`;
  }
  
  return phoneNumber;
};

const getContactInitials = (name: string): string => {
  return name
    .split(' ')
    .map(part => part[0])
    .slice(0, 2)  // Take only first two initials
    .join('')
    .toUpperCase();
};

const getAvatarUrl = (name: string, size: number = 48): string => {
  const initials = getContactInitials(name);
  const colors = ['1abc9c', '2ecc71', '3498db', '9b59b6', 'f1c40f', 'e67e22', 'e74c3c'];
  const colorIndex = Math.abs(name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)) % colors.length;
  const backgroundColor = colors[colorIndex];
  
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&size=${size}&background=${backgroundColor}&color=fff&bold=true&format=svg`;
};

const formatJID = (jid: string): ContactInfo => {
  // Remove @s.whatsapp.net and any other non-numeric characters for the phone
  const phoneNumber = jid.replace("@s.whatsapp.net", "").replace(/[^\d]/g, '');
  const formattedNumber = formatPhoneNumber(phoneNumber);
  
  // Generate a readable name if none exists
  const name = `Contact ${formattedNumber}`;
  
  return { 
    name, 
    phoneNumber: formattedNumber,
    imageUrl: getAvatarUrl(name)
  };
};

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

  // Chat Analysis state
  const [chatAnalysisConversations, setChatAnalysisConversations] = useState<Record<string, ChatAnalysisState>>({});
  const [chatAnalysisQuery, setChatAnalysisQuery] = useState("");
  const [isChatAnalysisLoading, setIsChatAnalysisLoading] = useState(false);
  const chatAnalysisMessagesContainerRef = useRef<HTMLDivElement>(null);
  const [chatAnalysisError, setChatAnalysisError] = useState<string | null>(null);
  const chatAnalysisQueryStartTime = useRef<number | null>(null);

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

  // Chat Analysis functions
  const updateChatAnalysisConversation = (
    jid: string,
    updater: (prev: ChatAnalysisState) => ChatAnalysisState
  ) => {
    setChatAnalysisConversations(prev => ({
      ...prev,
      [jid]: updater(prev[jid] || {
        messages: [],
        lastUpdated: Date.now(),
        totalQuestions: 0,
        errorCount: 0,
      }),
    }));
  };

  const getCurrentChatAnalysisConversation = () => {
    return selectedChat ? chatAnalysisConversations[selectedChat] || {
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

  const formatChatHistoryForAnalysis = (messages: Message[]): string => {
    return messages
      .map(msg => {
        const timestamp = new Date(msg.timestamp).toLocaleString();
        const sender = msg.fromMe ? "You" : "Contact";
        return `${timestamp} - ${sender}: ${msg.text}`;
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
    chatAnalysisQueryStartTime.current = Date.now();
    
    const newMessage: ChatAnalysisMessage = {
      id: `chat-analysis-${Date.now()}`,
      question: trimmedQuery,
      answer: "",
      timestamp: Date.now(),
      status: 'pending',
      isContactSpecific,
    };

    setChatAnalysisError(null);
    updateChatAnalysisConversation(selectedChat, prev => ({
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

      // If it's a contact-specific query, include chat history
      if (isContactSpecific && selectedChat) {
        const contactMessages = chatHistory[selectedChat] || [];
        if (contactMessages.length > 0) {
          requestBody.chat_data = formatChatHistoryForAnalysis(contactMessages);
        }
      }

      const response = await axios.post("http://localhost:8000/api/chat", requestBody);

      const processingTime = Date.now() - (chatAnalysisQueryStartTime.current || Date.now());
      
      updateChatAnalysisConversation(selectedChat, prev => ({
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
      
      updateChatAnalysisConversation(selectedChat, prev => ({
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
        delete newConversations[selectedChat];
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

  // Helper functions for AI Assistant (moved from earlier in file)
  // const formatProcessingTime = (time: number): string => {
  //   if (time < 1000) return `${time}ms`;
  //   return `${(time / 1000).toFixed(1)}s`;
  // };

  // const formatConfidence = (confidence: number): string => {
  //   return `${Math.round(confidence * 100)}%`;
  // };

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
          
          // Log the entire response for debugging
          console.log("Chats API Response:", {
            status: res.status,
            statusText: res.statusText,
            headers: res.headers,
            data: res.data
          });

          // Validate response data
          if (!res.data) {
            console.error("No data received from chats API");
            return;
          }

          // Check if data is empty
          const chatEntries = Object.entries(res.data);
          console.log("Number of chats received:", chatEntries.length);
          
          if (chatEntries.length === 0) {
            console.log("No chats available in the response");
            setChats([]);
            return;
          }

          // Process each chat with detailed logging
          const formattedChats = chatEntries
            .map(([jid, data]) => {
              console.log("Processing chat entry:", { jid, data });
              
              try {
                const existingMessages = chatHistory[jid] || [];
                const lastMessage = existingMessages[existingMessages.length - 1];
                
                // Parse the contact info
                const contactInfo = formatJID(jid);
                console.log("Parsed contact info:", contactInfo);

                // Determine name and timestamp
                let name = contactInfo.name;
                let timestamp = new Date().toISOString();

                if (typeof data === 'object' && data !== null && 'name' in data && 'timestamp' in data) {
                  console.log("Chat data is an object:", data);
                  if (data.name) {
                    name = data.name;
                  }
                  if (data.timestamp) {
                    timestamp = data.timestamp;
                  }
                } else if (typeof data === 'string') {
                  console.log("Chat data is a string timestamp:", data);
                  timestamp = data;
                }

                const chat: Chat = {
                  jid,
                  name,
                  phoneNumber: contactInfo.phoneNumber,
                  imageUrl: getAvatarUrl(name),
                  lastMessage: lastMessage?.text,
                  timestamp: new Date(timestamp).toLocaleString(),
                  timestampDate: new Date(timestamp),
                  unreadCount: 0,
                  messages: existingMessages
                };

                console.log("Formatted chat:", chat);
                return chat;
              } catch (error) {
                console.error("Error processing chat:", { jid, data, error });
                return null;
              }
            })
            .filter((chat): chat is NonNullable<typeof chat> => chat !== null)
            .sort((a, b) => b.timestampDate.getTime() - a.timestampDate.getTime());

          console.log("Final formatted chats:", formattedChats);
          setChats(formattedChats);
          
        } catch (error: any) {
          console.error("Failed to fetch chats:", {
            error: error,
            response: error.response?.data,
            status: error.response?.status,
            message: error.message
          });
          
          if (error.response?.status === 401) {
            console.log("Unauthorized - resetting connection state");
            setConnected(false);
          }
        }
      };

      // Initial fetch
      fetchChats();

      // Set up polling with a longer interval to avoid too many requests
      const pollInterval = setInterval(fetchChats, 5000);

      return () => clearInterval(pollInterval);
    } else {
      console.log("Not connected - clearing chats");
      setChats([]);
    }
  }, [connected, chatHistory]);

  // Filter chats to show only those with messages and matching search query
  const filteredChats = chats
    .filter(chat => {
      // First filter for chats with messages
      const hasMessages = chatHistory[chat.jid]?.length > 0;
      const hasLastMessage = !!chat.lastMessage;
      const hasActivity = hasMessages || hasLastMessage;

      // Then filter by search query
      const matchesSearch = chat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          chat.phoneNumber.toLowerCase().includes(searchQuery.toLowerCase());

      return hasActivity && matchesSearch;
    })
    .sort((a, b) => b.timestampDate.getTime() - a.timestampDate.getTime());

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

  const handleAiKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendAiQuery();
    }
  };

  const handleLogout = async () => {
    try {
      const res = await fetch("http://localhost:8080/api/full-logout", {
        method: "POST",
      });
      if (res.ok) {
        setConnected(false);
        setChats([]);
        setMessages([]);
        setSelectedChat(null);
      } else {
        console.error("Full logout returned non-OK status:", res.status);
      }
    } catch (error) {
      console.error("Full logout failed:", error);
    }
  };

  return (
    !connected ? (
      <div className="h-screen w-screen flex bg-[#f0f2f5] font-sans antialiased overflow-hidden">
        <div className="flex flex-col items-center justify-center flex-grow bg-white p-8 w-full">
          <div className="bg-white p-6 rounded-xl shadow-sm max-w-md w-full text-center">
            <h1 className="text-xl font-medium mb-6 text-gray-800">Connect to Messages</h1>
            <ol className="list-decimal list-inside space-y-4 mb-8 text-gray-600 text-sm">
              <li>Open WhatsApp on your phone</li>
              <li>Tap Menu or Settings and select WhatsApp Web</li>
              <li>Point your phone to this screen to capture the QR code</li>
            </ol>
            <div ref={qrRef} className="inline-block bg-white p-4 rounded-lg shadow-sm"></div>
          </div>
        </div>
      </div>
    ) : (
      <div className="h-screen w-screen flex bg-[#f0f2f5] font-sans antialiased overflow-hidden">
        {/* Left Panel - Chat List */}
        <div className="min-w-[280px] max-w-[420px] w-[30%] flex flex-col bg-white border-r border-gray-200">
          {/* Header */}
          <div className="px-4 py-3 bg-white border-b border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-600" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="flex-1 flex items-center justify-between">
                  <h2 className="text-[16px] font-medium text-gray-800">Messages</h2>
                  <button
                    onClick={handleLogout}
                    className="ml-2 px-3 py-1 rounded-lg bg-red-500 text-white text-xs hover:bg-red-600 transition-colors flex items-center gap-1"
                    title="Logout"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                      <polyline points="16 17 21 12 16 7" />
                      <line x1="21" y1="12" x2="9" y2="12" />
                    </svg>
                    <span>Logout</span>
                  </button>
                </div>
              </div>
              <div className="flex items-center">
                <button
                  onClick={() => { window.location.href = "http://localhost:5173/"; }}
                  className="px-3 py-1 rounded-lg bg-gray-200 text-gray-700 text-sm hover:bg-gray-300 transition-colors flex items-center gap-1"
                  title="Back"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                    <polyline points="15 18 9 12 15 6" />
                    <line x1="9" y1="12" x2="21" y2="12" />
                  </svg>
                  <span>Back</span>
                </button>
              </div>
            </div>
            {/* Search Bar */}
            <div className="relative">
              <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-[18px] w-[18px] text-gray-500" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                </svg>
              </div>
              <input
                type="text"
                placeholder="Search messages"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-gray-100 text-gray-800 placeholder-gray-500 pl-10 pr-4 py-[8px] rounded-lg focus:outline-none focus:bg-white focus:ring-1 focus:ring-gray-200 text-[15px]"
              />
            </div>
          </div>

          {/* Chat List */}
          <div className="flex-1 overflow-y-auto bg-white">
            {!connected && (
              <div className="flex items-center justify-center h-full">
                <div className="text-gray-500 text-sm">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent mx-auto mb-4"></div>
                  <p>Connecting to messages...</p>
                </div>
              </div>
            )}
            {connected && filteredChats.length === 0 && (
              <div className="flex items-center justify-center h-full">
                <div className="text-gray-500 text-sm text-center">
                  <p>No active chats</p>
                  <p className="text-xs mt-1">Chats will appear here when you receive messages</p>
                </div>
              </div>
            )}
            {connected && filteredChats.length > 0 && (
              <div className="divide-y divide-gray-100">
                {filteredChats.map((chat) => (
                  <button
                    key={chat.jid}
                    onClick={() => setSelectedChat(chat.jid)}
                    className={`w-full text-left px-4 py-3 hover:bg-gray-100 transition-colors duration-200 flex items-center space-x-3
                    ${selectedChat === chat.jid ? "bg-gray-100" : ""}`}
                  >
                    <div className="w-12 h-12 rounded-full bg-gray-200 flex-shrink-0 overflow-hidden">
                      <img 
                        src={chat.imageUrl}
                        alt={chat.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = getAvatarUrl(chat.name);
                        }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-baseline">
                        <span className="text-[16px] font-medium text-gray-800 truncate">{chat.name}</span>
                        <span className="text-xs text-gray-500 flex-shrink-0">{chat.timestamp || ''}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <p className="text-[14px] text-gray-500 truncate leading-5 flex-1">
                          {chat.phoneNumber}
                          {chat.lastMessage && (
                            <>
                              <span className="mx-1">·</span>
                              {chat.lastMessage}
                            </>
                          )}
                        </p>
                        {chat.unreadCount > 0 && (
                          <span className="flex-shrink-0 bg-[#25d366] text-white rounded-full text-xs px-[6px] py-[2px] min-w-[20px] text-center">
                            {chat.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Middle Panel - Chat Window */}
        <div className="flex-1 min-w-[500px] max-w-[800px] flex flex-col bg-[#efeae2] relative">
          {!connected ? (
            <div className="flex flex-col items-center justify-center flex-grow bg-white p-8">
              <div className="bg-white p-6 rounded-xl shadow-sm max-w-md w-full text-center">
                <h1 className="text-xl font-medium mb-6 text-gray-800">Connect to Messages</h1>
                <ol className="list-decimal list-inside space-y-4 mb-8 text-gray-600 text-sm">
                  <li>Open WhatsApp on your phone</li>
                  <li>Tap Menu or Settings and select WhatsApp Web</li>
                  <li>Point your phone to this screen to capture the QR code</li>
                </ol>
                <div ref={qrRef} className="inline-block bg-white p-4 rounded-lg shadow-sm"></div>
              </div>
            </div>
          ) : selectedChat ? (
            <>
              {/* Chat Header */}
              <div className="absolute top-0 left-0 right-0 z-10">
                <div className="px-4 py-2 bg-[#f0f2f5] flex items-center space-x-4 border-b border-gray-200">
                  {selectedChat && (() => {
                    const chat = chats.find(c => c.jid === selectedChat);
                    if (!chat) return null;
                    
                    return (
                      <>
                        <div className="w-10 h-10 rounded-full bg-gray-200 flex-shrink-0 overflow-hidden">
                          <img 
                            src={chat.imageUrl}
                            alt={chat.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.src = getAvatarUrl(chat.name);
                            }}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h2 className="text-[16px] font-medium text-gray-800 truncate">{chat.name}</h2>
                          <p className="text-sm text-gray-500">{chat.phoneNumber}</p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <button className="p-2 rounded-full hover:bg-gray-200/60 transition-colors duration-200">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-600" viewBox="0 0 20 20" fill="currentColor">
                              <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                            </svg>
                          </button>
                          <button className="p-2 rounded-full hover:bg-gray-200/60 transition-colors duration-200">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-600" viewBox="0 0 20 20" fill="currentColor">
                              <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                            </svg>
                          </button>
                          <button className="p-2 rounded-full hover:bg-gray-200/60 transition-colors duration-200">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-600" viewBox="0 0 20 20" fill="currentColor">
                              <path d="M6 10a2 2 0 11-4 0 2 2 0 004 0zM12 10a2 2 0 11-4 0 2 2 0 014 0zM16 12a2 2 0 100-4 2 2 0 000 4z" />
                            </svg>
                          </button>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Messages Area */}
              <div 
                className="flex-1 overflow-y-auto p-4 pt-20 bg-[#efeae2] bg-opacity-90 bg-[url('/whatsapp-bg.png')] bg-repeat" 
                ref={messagesContainerRef}
                onScroll={handleScroll}
              >
                {loading ? (
                  <div className="flex justify-center items-center h-full">
                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent"></div>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex ${msg.fromMe ? "justify-end" : "justify-start"} mb-1`}
                      >
                        <div
                          className={`max-w-[65%] px-3 py-2 shadow-sm ${
                            msg.fromMe 
                            ? "bg-[#d9fdd3] rounded-xl rounded-tr-none" 
                            : "bg-white rounded-xl rounded-tl-none border border-gray-200"
                          }`}
                        >
                          <p className="text-[14.2px] text-gray-800 leading-[19px] whitespace-pre-wrap break-words">
                            {msg.text}
                          </p>
                          <div className="flex items-center justify-end gap-1 mt-1">
                            <p className="text-xs text-gray-500">
                              {new Date(msg.timestamp).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit"
                              })}
                            </p>
                            {msg.fromMe && (
                              <span className="text-gray-500">
                                {msg.status === 'sent' && (
                                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3">
                                    <path fillRule="evenodd" d="M3.97 3.97a.75.75 0 011.06 0l13.72 13.72V8.25a.75.75 0 011.5 0V19.5a.75.75 0 01-.75.75H8.25a.75.75 0 010-1.5h9.44L3.97 5.03a.75.75 0 010-1.06z" clipRule="evenodd" />
                                  </svg>
                                )}
                                {msg.status === 'delivered' && (
                                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3">
                                    <path fillRule="evenodd" d="M4.72 3.97a.75.75 0 011.06 0l7.5 7.5a.75.75 0 010 1.06l-7.5 7.5a.75.75 0 11-1.06-1.06L11.69 12 4.72 5.03a.75.75 0 010-1.06zm6 0a.75.75 0 011.06 0l7.5 7.5a.75.75 0 010 1.06l-7.5 7.5a.75.75 0 11-1.06-1.06L17.69 12l-6.97-6.97a.75.75 0 010-1.06z" clipRule="evenodd" />
                                  </svg>
                                )}
                                {msg.status === 'read' && (
                                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#53bdeb" className="w-3 h-3">
                                    <path fillRule="evenodd" d="M4.72 3.97a.75.75 0 011.06 0l7.5 7.5a.75.75 0 010 1.06l-7.5 7.5a.75.75 0 11-1.06-1.06L17.69 12l-6.97-6.97a.75.75 0 010-1.06z" clipRule="evenodd" />
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
              <div className="p-3 bg-[#f0f2f5]">
                <div className="flex items-center space-x-2 bg-white px-4 py-3 rounded-lg">
                  <button className="p-2 rounded-full hover:bg-gray-100 transition-colors duration-200">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-600" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9a1 1 0 100-2 1 1 0 000 2zm7-1a1 1 0 11-2 0 1 1 0 012 0zm-7.536 5.879a1 1 0 001.415 0 3 3 0 014.242 0 1 1 0 001.415-1.415 5 5 0 00-7.072 0 1 1 0 000 1.415z" clipRule="evenodd" />
                    </svg>
                  </button>
                  <button className="p-2 rounded-full hover:bg-gray-100 transition-colors duration-200">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-600" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                  <div className="flex-1">
                    <textarea
                      value={newMsg}
                      onChange={(e) => setNewMsg(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder="Type a message"
                      className="w-full bg-transparent text-gray-800 placeholder-gray-500 resize-none focus:outline-none min-h-[24px] max-h-[100px] text-[15px]"
                      rows={1}
                    />
                  </div>
                  {!newMsg.trim() ? (
                    <button className="p-2 rounded-full hover:bg-gray-100 transition-colors duration-200">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-600" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                      </svg>
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        if (newMsg.trim() && selectedChat) {
                          sendMessage();
                        }
                      }}
                      className="p-2 rounded-full bg-[#00a884] hover:bg-[#00916e] text-white transition-colors duration-200"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mb-4 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
              </svg>
              <p className="text-lg font-light">Select a chat to start messaging</p>
            </div>
          )}
        </div>

        {/* Right Panel - AI Assistant & Chat Analysis */}
        <div className="min-w-[320px] max-w-[400px] w-[30%] flex flex-col bg-[#f7f8fa] border-l border-gray-200">
          {/* AI Assistant Section */}
          <div className="flex-1 flex flex-col">
            <div className="px-4 py-3 bg-white border-b border-gray-200 flex justify-between items-center">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-4-8c0-.55.45-1 1-1s1 .45 1 1-.45 1-1 1-1-.45-1-1zm4 0c0-.55.45-1 1-1s1 .45 1 1-.45 1-1 1-1-.45-1-1z"/>
                  </svg>
                </div>
                <div>
                  <h2 className="text-[16px] font-medium text-gray-800">AI Assistant</h2>
                  {selectedChat && currentAiConversation.totalQuestions > 0 && (
                    <div className="text-[13px] text-gray-500 flex items-center space-x-2">
                      <span>{currentAiConversation.totalQuestions} questions asked</span>
                      {currentAiConversation.errorCount > 0 && (
                        <span className="text-red-500">({currentAiConversation.errorCount} errors)</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
              {currentAiConversation.messages.length > 0 && (
                <button
                  onClick={clearAiHistory}
                  className="p-2 rounded-full hover:bg-gray-100 transition-colors duration-200"
                  title="Clear history"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-600" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </button>
              )}
            </div>

            {aiError && (
              <div className="px-4 py-2 bg-red-50 border-b border-red-100">
                <p className="text-sm text-red-600 flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  {aiError}
                </p>
              </div>
            )}

            <div 
              ref={aiMessagesContainerRef}
              className="flex-1 overflow-y-auto p-4 bg-[#f7f8fa]"
            >
              {selectedChat ? (
                <>
                  {currentAiConversation.messages.map((msg) => (
                    <div key={msg.id} className="mb-4">
                      <div className="flex flex-col space-y-2">
                        <div className="flex justify-end">
                          <div className="max-w-[85%] bg-blue-50 rounded-lg px-3 py-2 shadow-sm">
                            <p className="text-[14px] text-gray-800">{msg.question}</p>
                            <p className="text-xs text-gray-500 text-right mt-1">
                              {new Date(msg.timestamp).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit"
                              })}
                            </p>
                          </div>
                        </div>
                        {msg.status === 'complete' && (
                          <div className="flex justify-start">
                            <div className="max-w-[85%] bg-white rounded-lg px-3 py-2 shadow-sm">
                              <p className="text-[14px] text-gray-800 whitespace-pre-wrap">{msg.answer}</p>
                              {msg.metadata && (
                                <div className="mt-2 pt-2 border-t border-gray-100">
                                  <div className="flex items-center justify-between text-xs text-gray-500">
                                    <span>Processing: {formatProcessingTime(msg.metadata.processingTime)}</span>
                                    <span>Confidence: {formatConfidence(msg.metadata.confidence)}</span>
                                  </div>
                                  {msg.metadata.relevantDates.length > 0 && (
                                    <div className="mt-1 text-xs text-gray-500">
                                      <span>Relevant dates: {msg.metadata.relevantDates.join(", ")}</span>
                                    </div>
                                  )}
                                </div>
                              )}
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
                                  <div className="h-2 w-2 bg-blue-500 rounded-full"></div>
                                  <div className="h-2 w-2 bg-blue-500 rounded-full animation-delay-200"></div>
                                  <div className="h-2 w-2 bg-blue-500 rounded-full animation-delay-400"></div>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                        {msg.status === 'error' && (
                          <div className="flex justify-start">
                            <div className="max-w-[85%] bg-red-50 rounded-lg px-3 py-2 shadow-sm">
                              <p className="text-[14px] text-red-600">{msg.error}</p>
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
                  ))}
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-gray-500">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mb-4 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                  </svg>
                  <p className="text-lg font-light">Select a chat to start AI analysis</p>
                </div>
              )}
            </div>

            <div className="p-3 bg-white border-t border-gray-200">
              <div className="flex items-center space-x-2 bg-[#f7f8fa] px-4 py-3 rounded-lg">
                <div className="flex-1">
                  <textarea
                    value={aiQuery}
                    onChange={(e) => setAiQuery(e.target.value)}
                    onKeyPress={handleAiKeyPress}
                    placeholder="Ask about the conversation..."
                    disabled={!selectedChat || isAiLoading}
                    className={`w-full bg-transparent text-gray-800 placeholder-gray-500 resize-none focus:outline-none min-h-[24px] max-h-[100px] text-[14px] ${
                      !selectedChat ? "cursor-not-allowed" : ""
                    }`}
                    rows={1}
                  />
                </div>
                {!aiQuery.trim() ? (
                  <button 
                    className="p-2 rounded-full hover:bg-gray-100 transition-colors duration-200"
                    disabled={!selectedChat}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-600" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                    </svg>
                  </button>
                ) : (
                  <button
                    onClick={sendAiQuery}
                    disabled={!selectedChat || isAiLoading || !aiQuery.trim()}
                    className={`p-2 rounded-full transition-colors duration-200 ${
                      !selectedChat || isAiLoading
                        ? "bg-gray-200 cursor-not-allowed"
                        : "bg-blue-600 hover:bg-blue-700 text-white"
                    }`}
                  >
                    {isAiLoading ? (
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Chat Analysis Section */}
          <div className="flex-1 flex flex-col border-t border-gray-200">
            <div className="px-4 py-3 bg-white border-b border-gray-200 flex justify-between items-center">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-600" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.94-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
                  </svg>
                </div>
                <div>
                  <h2 className="text-[16px] font-medium text-gray-800">
                    Chat Analysis
                    {selectedChat && (() => {
                      const chat = chats.find(c => c.jid === selectedChat);
                      return chat ? `: ${chat.name}` : '';
                    })()}
                  </h2>
                  {selectedChat && getCurrentChatAnalysisConversation().totalQuestions > 0 && (
                    <div className="text-[13px] text-gray-500 flex items-center space-x-2">
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
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-600" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </button>
              )}
            </div>

            {chatAnalysisError && (
              <div className="px-4 py-2 bg-red-50 border-b border-red-100">
                <p className="text-sm text-red-600 flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  {chatAnalysisError}
                </p>
              </div>
            )}

            <div 
              ref={chatAnalysisMessagesContainerRef}
              className="flex-1 overflow-y-auto p-4 bg-[#f7f8fa]"
            >
              {selectedChat ? (
                <>
                  {getCurrentChatAnalysisConversation().messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-500">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mb-3 text-gray-400" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.94-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
                      </svg>
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
                              <p className="text-[14px] text-gray-800">{msg.question}</p>
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
                                <p className="text-[14px] text-gray-800 whitespace-pre-wrap">{msg.answer}</p>
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
                                <p className="text-[14px] text-red-600">{msg.error}</p>
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
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mb-4 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                  </svg>
                  <p className="text-lg font-light">Please select a contact from the Contacts Panel to start chat analysis</p>
                </div>
              )}
            </div>

            <div className="p-3 bg-white border-t border-gray-200">
              <div className="flex items-center space-x-2 bg-[#f7f8fa] px-4 py-3 rounded-lg">
                <div className="flex-1">
                  <textarea
                    value={chatAnalysisQuery}
                    onChange={(e) => setChatAnalysisQuery(e.target.value)}
                    onKeyPress={handleChatAnalysisKeyPress}
                    placeholder="Ask about this chat or anything else..."
                    disabled={!selectedChat || isChatAnalysisLoading}
                    className={`w-full bg-transparent text-gray-800 placeholder-gray-500 resize-none focus:outline-none min-h-[24px] max-h-[100px] text-[14px] ${
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
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-600" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                    </svg>
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
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  );
};

export default WhatsAppWebPage;
