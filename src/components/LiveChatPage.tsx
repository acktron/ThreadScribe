import React, { useState } from "react";

const LiveChatPage: React.FC = () => {
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [statusType, setStatusType] = useState<"success" | "error" | null>(null);
  const [loading, setLoading] = useState(false);

  const sendMessage = async () => {
    if (!phone.trim() || !message.trim()) {
      setStatusType("error");
      setStatus("Please enter both phone number and message.");
      return;
    }

    setLoading(true);
    setStatus(null);

    try {
      const res = await fetch("http://localhost:8000/api/mcp/send-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, message }),
      });

      const data = await res.json();
      if (res.ok) {
        setStatusType("success");
        setStatus("✅ Message sent successfully!");
        setMessage("");
      } else {
        setStatusType("error");
        setStatus(data.error || "❌ Failed to send message.");
      }
    } catch {
      setStatusType("error");
      setStatus("❌ Error sending message.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-white flex flex-col items-center justify-center px-6 py-12">
      <h1 className="text-4xl font-extrabold mb-10 text-indigo-700 drop-shadow-md">
        Live WhatsApp Messaging
      </h1>
      <div className="w-full max-w-md bg-white p-8 rounded-lg shadow-lg">
        <input
          type="text"
          placeholder="Recipient phone number with country code"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="w-full mb-4 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
          disabled={loading}
        />
        <textarea
          placeholder="Your message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="w-full mb-6 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition resize-none"
          rows={5}
          disabled={loading}
        />
        <button
          onClick={sendMessage}
          disabled={loading}
          className={`w-full py-3 rounded-lg text-white font-semibold transition ${
            loading
              ? "bg-indigo-400 cursor-not-allowed"
              : "bg-indigo-600 hover:bg-indigo-700"
          }`}
        >
          {loading ? "Sending..." : "Send Message"}
        </button>
        {status && (
          <p
            className={`mt-4 text-center font-medium text-sm ${
              statusType === "success" ? "text-green-600" : "text-red-600"
            }`}
          >
            {status}
          </p>
        )}
      </div>
    </div>
  );
};

export default LiveChatPage;
