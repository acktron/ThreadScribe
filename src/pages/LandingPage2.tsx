const LandingPage = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white text-center px-4">
      <img src="https://img.icons8.com/color/96/whatsapp.png"
        alt="WhatsApp"
        className="w-16 h-16 mb-4" 
      />
      <h1 className="text-3xl font-bold mb-2">WhatsApp Chat Analyzer</h1>
      <p className="text-gray-600 mb-6">
        Analyze and explore your WhatsApp chat history.
      </p>
      <button
        className="bg-blue-600 text-white px-6 py-3 rounded-md text-lg hover:bg-blue-700 transition"
      >
        Upload WhatsApp Chat
      </button>
      <a href="/privacy" className="mt-6 text-sm text-gray-500 underline">
        Privacy Policy
      </a>
    </div>
  );
};

export default LandingPage;
