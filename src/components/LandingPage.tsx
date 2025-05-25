import React from "react";
import Header from "./Header";
import { Link } from "react-router-dom";

const LandingPage = () => {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-800">
      <Header />

      <section className="text-center py-20 px-6">
        <h2 className="text-4xl font-bold mb-4">Welcome to ThreadScribe 👋</h2>
        <p className="text-lg mb-8 max-w-2xl mx-auto">
          Upload your WhatsApp chats or connect live and let ThreadScribe convert them into clean, readable threads.
        </p>

        <div className="flex justify-center space-x-4 flex-wrap">
          <Link
            to="/upload"
            className="bg-teal-600 hover:bg-teal-700 text-white font-semibold py-3 px-6 rounded-xl transition duration-300"
          >
            Upload WhatsApp Chat
          </Link>
          <Link
            to="/live-chat"
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-6 rounded-xl transition duration-300"
          >
            Connect Live Chat
          </Link>
          <Link
            to="/qr-chat"
            className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-6 rounded-xl transition duration-300"
          >
            WhatsApp QR + Chat UI
          </Link>
        </div>
      </section>

      <section className="bg-white py-16 px-6">
        <h3 className="text-3xl font-semibold text-center mb-8">How It Works</h3>
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            {
              title: "1. Choose Mode",
              desc: "Upload a chat file, connect live, or use the QR + UI.",
            },
            {
              title: "2. Let AI Process",
              desc: "We analyze the messages and convert them into a clean thread.",
            },
            {
              title: "3. Read It",
              desc: "Get a beautifully formatted thread you can scroll and read.",
            },
          ].map((step) => (
            <div
              key={step.title}
              className="bg-gray-100 p-6 rounded-lg shadow-sm text-left"
            >
              <h4 className="text-xl font-bold mb-2">{step.title}</h4>
              <p>{step.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default LandingPage;
