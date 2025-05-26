import React, { useEffect, useState } from "react";
import QRCode from "react-qr-code";
import axios from "axios";

const WhatsAppWebPage = () => {
  const [qr, setQr] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [chats, setChats] = useState<{ [jid: string]: string } | null>(null);
  const [selectedChat, setSelectedChat] = useState<string | null>(null);
  const [messages, setMessages] = useState<string[]>([]);
  const [newMsg, setNewMsg] = useState("");

  // Step 1: Fetch QR and start polling for status
  useEffect(() => {
    const fetchQR = async () => {
      const res = await axios.get("http://localhost:8000/api/mcp/qr");
      setQr(res.data.qr);
    };

    fetchQR();

    const interval = setInterval(async () => {
      const res = await axios.get("http://localhost:8000/api/mcp/status");
      if (res.data.status === "CONNECTED" || res.data.connected === true) {
        setConnected(true);
        clearInterval(interval);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  // Step 2: Once connected, load chat list
  useEffect(() => {
    if (connected) {
      axios.get("http://localhost:8000/api/mcp/chats").then((res) => {
        setChats(res.data);
      });
    }
  }, [connected]);

  // Step 3: Load messages when a chat is selected
  useEffect(() => {
    if (selectedChat) {
      axios
        .get(`http://localhost:8000/api/mcp/messages?chatId=${selectedChat}`)
        .then((res) => setMessages(res.data.messages));
    }
  }, [selectedChat]);

  const sendMessage = async () => {
    if (!selectedChat || !newMsg.trim()) return;
    try {
      await axios.post("http://localhost:8000/api/mcp/send", {
        recipient: selectedChat,
        message: newMsg,
      });
      setNewMsg("");
      // Reload messages after sending
      const res = await axios.get(
        `http://localhost:8000/api/mcp/messages?chatId=${selectedChat}`
      );
      setMessages(res.data.messages);
    } catch (error) {
      console.error("Failed to send message", error);
    }
  };

  return (
    <div className="flex h-screen">
      {/* Left Panel */}
      <div className="w-1/3 bg-gray-100 p-6 border-r border-gray-300 overflow-y-auto">
        <h2 className="text-xl font-semibold mb-4">Chats</h2>
        {!connected && <p>Waiting for connection...</p>}
        {connected && chats && (
          <ul className="space-y-2">
            {Object.entries(chats).map(([jid, lastTime]) => (
              <li key={jid}>
                <button
                  className={`w-full text-left px-3 py-2 rounded-lg ${
                    selectedChat === jid
                      ? "bg-teal-600 text-white"
                      : "hover:bg-gray-200"
                  }`}
                  onClick={() => setSelectedChat(jid)}
                >
                  {jid}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Right Panel */}
      <div className="w-2/3 flex flex-col bg-white p-8">
        {!connected && qr ? (
          <div className="flex flex-col items-center justify-center flex-grow">
            <h1 className="text-2xl font-bold mb-4">Scan QR to Login</h1>
            <QRCode value={qr} size={200} />
          </div>
        ) : connected && selectedChat ? (
          <>
            <h1 className="text-xl font-semibold mb-4">
              Chat: <span className="font-mono">{selectedChat}</span>
            </h1>
            <div className="flex-1 overflow-y-auto border rounded p-4 mb-4">
              {messages.length > 0 ? (
                messages
                  .slice()
                  .reverse()
                  .map((msg, idx) => (
                    <div key={idx} className="mb-2">
                      <span className="text-sm">{msg}</span>
                    </div>
                  ))
              ) : (
                <p className="text-gray-500 italic">No messages yet.</p>
              )}
            </div>
            <div className="flex space-x-2">
              <input
                value={newMsg}
                onChange={(e) => setNewMsg(e.target.value)}
                className="flex-1 border rounded px-3 py-2"
                placeholder="Type a message..."
              />
              <button
                onClick={sendMessage}
                className="bg-blue-600 text-white px-4 rounded hover:bg-blue-700"
              >
                Send
              </button>
            </div>
          </>
        ) : connected ? (
          <p className="text-center text-gray-600 mt-10">
            Select a chat from the left panel to begin
          </p>
        ) : (
          <p className="text-gray-500">Loading QR...</p>
        )}
      </div>
    </div>
  );
};

export default WhatsAppWebPage;
