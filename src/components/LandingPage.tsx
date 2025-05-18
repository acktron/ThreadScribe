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
          Upload your WhatsApp chats and let ThreadScribe convert them into clean, readable threads.
        </p>

        <Link to="/upload"
          className="inline-block bg-teal-600 hover:bg-teal-700 text-white font-semibold py-3 px-6 rounded-xl transition duration-300"
        >
          Upload WhatsApp Chat
        </Link>
      </section>

      <section className="bg-white py-16 px-6">
        <h3 className="text-3xl font-semibold text-center mb-8">How It Works</h3>
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            {
              title: "1. Upload Chat",
              desc: "Select and upload your WhatsApp chat (.txt) file.",
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
