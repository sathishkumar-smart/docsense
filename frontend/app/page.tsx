"use client";
import { useState, useRef } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [collectionName, setCollectionName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadDone, setUploadDone] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setUploadDone(false);
    setMessages([]);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("http://localhost:8000/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Upload failed");
      setCollectionName(data.collection_name);
      setUploadDone(true);
      setMessages([{
        role: "assistant",
        content: `✅ Document uploaded! I split it into ${data.chunks} chunks and stored the embeddings. You can now ask me anything about **${data.filename}**!`
      }]);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Upload failed";
      setMessages([{ role: "assistant", content: `❌ Error: ${message}` }]);
    } finally {
      setUploading(false);
    }
  };

  const handleAsk = async () => {
    if (!question.trim() || !collectionName || loading) return;

    const userMsg: Message = { role: "user", content: question };
    setMessages(prev => [...prev, userMsg]);
    setQuestion("");
    setLoading(true);

    try {
      const res = await fetch("http://localhost:8000/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: userMsg.content, collection_name: collectionName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Error");

      setMessages(prev => [...prev, { role: "assistant", content: data.answer }]);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      setMessages(prev => [...prev, { role: "assistant", content: `❌ ${message}` }]);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setCollectionName("");
    setUploadDone(false);
    setMessages([]);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <main className="min-h-screen bg-gray-950 text-white flex flex-col items-center py-10 px-4">

      {/* Header */}
      <div className="w-full max-w-2xl mb-8">
        <h1 className="text-3xl font-bold text-white">📄 DocSense</h1>
        <p className="text-gray-400 mt-1 text-sm">
          Upload a PDF and ask questions — AI answers from your document
        </p>
      </div>

      {/* Upload Card */}
      <div className="w-full max-w-2xl bg-gray-900 rounded-2xl p-6 mb-6 shadow-xl">
        <h2 className="text-sm font-semibold text-gray-400 uppercase mb-4">
          Step 1 — Upload Document
        </h2>

        <div className="flex gap-3 items-center">
          <input
            ref={fileRef}
            type="file"
            accept=".pdf"
            onChange={(e) => {
              setFile(e.target.files?.[0] || null);
              setUploadDone(false);
              setMessages([]);
              setCollectionName("");
            }}
            className="flex-1 text-sm text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-600 file:text-white file:cursor-pointer hover:file:bg-blue-500"
          />
          <button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed px-5 py-2 rounded-xl text-sm font-semibold transition"
          >
            {uploading ? "Uploading..." : "Upload"}
          </button>
          {uploadDone && (
            <button
              onClick={handleReset}
              className="text-sm text-gray-400 hover:text-white transition"
            >
              Reset
            </button>
          )}
        </div>

        {uploadDone && (
          <div className="mt-3 text-xs text-green-400">
            ✅ Ready — now ask questions below
          </div>
        )}
      </div>

      {/* Chat Window */}
      <div className="w-full max-w-2xl bg-gray-900 rounded-2xl flex flex-col shadow-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-800">
          <h2 className="text-sm font-semibold text-gray-400 uppercase">
            Step 2 — Ask Questions
          </h2>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 min-h-[340px] max-h-[400px]">
          {messages.length === 0 && (
            <div className="text-center text-gray-600 mt-16">
              <p className="text-4xl mb-3">🔍</p>
              <p className="text-sm">Upload a PDF to get started</p>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`flex items-end gap-2 max-w-[85%] ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0
                  ${msg.role === "user" ? "bg-blue-600" : "bg-purple-700"}`}>
                  {msg.role === "user" ? "You" : "AI"}
                </div>
                <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap
                  ${msg.role === "user"
                    ? "bg-blue-600 text-white rounded-br-sm"
                    : "bg-gray-800 text-gray-100 rounded-bl-sm"
                  }`}>
                  {msg.content}
                </div>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="flex items-end gap-2">
                <div className="w-7 h-7 rounded-full bg-purple-700 flex items-center justify-center text-xs font-bold">
                  AI
                </div>
                <div className="bg-gray-800 px-4 py-3 rounded-2xl rounded-bl-sm">
                  <div className="flex space-x-1 items-center h-4">
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]"></span>
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]"></span>
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]"></span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="border-t border-gray-800 p-4 flex gap-3">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAsk()}
            placeholder={uploadDone ? "Ask anything about your document..." : "Upload a PDF first..."}
            disabled={!uploadDone || loading}
            className="flex-1 bg-gray-800 text-white placeholder-gray-500 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
          />
          <button
            onClick={handleAsk}
            disabled={!uploadDone || loading || !question.trim()}
            className="bg-purple-700 hover:bg-purple-600 disabled:opacity-40 disabled:cursor-not-allowed px-5 py-3 rounded-xl text-sm font-semibold transition"
          >
            {loading ? "..." : "Ask"}
          </button>
        </div>
      </div>

      <p className="text-xs text-gray-600 mt-6">
        Built with FastAPI + ChromaDB + Ollama + Next.js
      </p>

    </main>
  );
}