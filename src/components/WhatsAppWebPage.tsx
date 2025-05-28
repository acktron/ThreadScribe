import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import QRCodeStyling from "qr-code-styling";

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
        const res = await axios.get("http://localhost:8080/api/qr");
        if (res.data.qr) {
          setQr(res.data.qr);
        }
      } catch (error) {
        console.error("Failed to fetch QR:", error);
      }
    };

    const checkStatus = async () => {
      try {
        const res = await axios.get("http://localhost:8080/api/status");
        if (res.data.connected === true) {
          setConnected(true);
          setQr(null); // Clear QR when connected
        } else {
          setConnected(false);
          // Fetch QR if not connected
          fetchQR();
        }
      } catch (error) {
        console.error("Failed to check status:", error);
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
          const res = await axios.get(`http://localhost:8080/api/messages?chatId=${selectedChat}`);
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
          const res = await axios.get("http://localhost:8080/api/chats");
          console.log("Received chats response:", res.data);
          
          const formattedChats = Object.entries(res.data).map(([jid, timestamp]) => {
            console.log("Processing chat:", { jid, timestamp });
            const existingMessages = chatHistory[jid] || [];
            const lastMessage = existingMessages[existingMessages.length - 1];
            
            return {
              jid,
              name: formatJID(jid),
              timestamp: new Date(timestamp as string).toLocaleString(),
              timestampDate: new Date(timestamp as string),
              unreadCount: 0,
              messages: existingMessages,
              lastMessage: lastMessage?.text
            };
          }).sort((a, b) => b.timestampDate.getTime() - a.timestampDate.getTime());
          console.log("Formatted chats:", formattedChats);
          setChats(formattedChats);
        } catch (error) {
          console.error("Failed to fetch chats:", error);
        }
      };

      // Initial fetch
      fetchChats();

      // Set up polling every 3 seconds
      const pollInterval = setInterval(fetchChats, 3000);

      return () => clearInterval(pollInterval);
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

  return (
    <div className="flex h-screen bg-[#f0f2f5]">
      {/* Left Panel - Chat List */}
      <div className="w-1/3 flex flex-col border-r border-gray-200">
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

      {/* Right Panel - Chat Window */}
      <div className="w-2/3 flex flex-col bg-[#f8f9fa]">
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
                    <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
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
    </div>
  );
};

export default WhatsAppWebPage;
