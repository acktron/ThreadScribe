import React, { useEffect, useState } from "react";
import QRCode from "react-qr-code";
import axios from "axios";

const WhatsAppWebPage = () => {
  const [qr, setQr] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState<string[]>([]);

  useEffect(() => {
    const fetchQR = async () => {
      const res = await axios.get("http://localhost:8000/api/mcp/qr");
      setQr(res.data.qr);
    };

    fetchQR();

    const interval = setInterval(async () => {
      const res = await axios.get("http://localhost:8000/api/mcp/status");
      if (res.data.status === "CONNECTED") {
        setConnected(true);
        clearInterval(interval);
        const messagesRes = await axios.get("http://localhost:8000/api/mcp/messages");
        setMessages(messagesRes.data.messages);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex h-screen">
      {/* Left Panel */}
      <div className="w-1/3 bg-gray-100 p-6 border-r border-gray-300">
        <h2 className="text-xl font-semibold mb-4">Sync Options</h2>
        <p>Select channels/chats to sync and enable search.</p>
        <button className="mt-6 bg-teal-600 hover:bg-teal-700 text-white py-2 px-4 rounded-lg">
          Sync Chats
        </button>
      </div>

      {/* Right Panel */}
      <div className="w-2/3 flex flex-col items-center justify-center bg-white p-8">
        {!connected && qr ? (
          <>
            <h1 className="text-2xl font-bold mb-4">Scan QR to Login</h1>
            <QRCode value={qr} size={200} />
          </>
        ) : connected ? (
          <>
            <h1 className="text-2xl font-bold mb-4">You're Connected 🎉</h1>
            <div className="w-full max-h-[500px] overflow-y-auto border rounded p-4">
              {messages.map((msg, idx) => (
                <div key={idx} className="mb-2">
                  <span className="text-sm">{msg}</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="text-gray-500">Loading QR...</p>
        )}
      </div>
    </div>
  );
};

export default WhatsAppWebPage;
