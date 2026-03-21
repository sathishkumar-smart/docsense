"use client";
import { useState, useRef, useEffect } from "react";

const API = "http://localhost:8000";

interface Message {
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
}

interface Document {
  id: string;
  filename: string;
  collection_name: string;
  chunk_count: number;
  uploaded_at: string;
}

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
    </svg>
  );
}

function UploadProgress({ stage }: { stage: string }) {
  const stages = ["Reading PDF", "Extracting Text", "Creating Chunks", "Storing Embeddings"];
  const current = stages.indexOf(stage);
  return (
    <div className="mt-4 p-4 bg-gray-800 rounded-xl">
      <p className="text-xs text-gray-400 mb-3 font-semibold uppercase tracking-wider">Processing Document</p>
      <div className="space-y-2">
        {stages.map((s, i) => (
          <div key={s} className="flex items-center gap-3">
            <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0
              ${i < current ? "bg-green-500" : i === current ? "bg-blue-500" : "bg-gray-700"}`}>
              {i < current ? (
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              ) : i === current ? (
                <Spinner />
              ) : (
                <span className="w-2 h-2 rounded-full bg-gray-600" />
              )}
            </div>
            <span className={`text-sm ${i === current ? "text-white font-medium" : i < current ? "text-green-400" : "text-gray-600"}`}>
              {s}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Home() {
  const [view, setView] = useState<"auth" | "app">("auth");
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [token, setToken] = useState("");
  const [username, setUsername] = useState("");
  const [formData, setFormData] = useState({ username: "", email: "", password: "" });
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadStage, setUploadStage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (token) fetchDocuments();
  }, [token]);

  const fetchDocuments = async () => {
    const res = await fetch(`${API}/documents/?token=${token}`);
    const data = await res.json();
    setDocuments(data);
  };

  // ── Auth ──
  const handleAuth = async () => {
    setAuthError("");
    setAuthLoading(true);
    const url = authMode === "login" ? `${API}/auth/login` : `${API}/auth/register`;
    const body = authMode === "login"
      ? { username: formData.username, password: formData.password }
      : formData;

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setAuthError(data.detail || "Something went wrong"); return; }
      if (authMode === "login") {
        setToken(data.access_token);
        setUsername(formData.username);
        setView("app");
      } else {
        setAuthMode("login");
        setAuthError("✅ Registered successfully! Please login.");
      }
    } finally {
      setAuthLoading(false);
    }
  };

  // ── Upload ──
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);

    // Simulate stages
    setUploadStage("Reading PDF");
    await new Promise(r => setTimeout(r, 600));
    setUploadStage("Extracting Text");
    await new Promise(r => setTimeout(r, 800));
    setUploadStage("Creating Chunks");

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch(`${API}/documents/upload?token=${token}`, {
      method: "POST",
      body: formData,
    });
    const data = await res.json();

    setUploadStage("Storing Embeddings");
    await new Promise(r => setTimeout(r, 700));

    setUploading(false);
    setUploadStage("");

    if (fileRef.current) fileRef.current.value = "";

    if (res.ok) {
      await fetchDocuments();
      setSelectedDoc(data.document);
      setMessages([{
        role: "assistant",
        content: `✅ **${data.document.filename}** is ready!\n\nI split it into **${data.document.chunk_count} semantic chunks** and stored the embeddings. Ask me anything about this document!`
      }]);
    }
  };

  // ── Ask with Streaming ──
  const handleAsk = async () => {
    if (!question.trim() || !selectedDoc || loading) return;
    const userMsg: Message = { role: "user", content: question };
    setMessages(prev => [...prev, userMsg]);
    setQuestion("");
    setLoading(true);
    setMessages(prev => [...prev, { role: "assistant", content: "", streaming: true }]);

    try {
      const res = await fetch(`${API}/chat/ask/stream?token=${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: userMsg.content, collection_name: selectedDoc.collection_name }),
      });

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let fullAnswer = "";

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;
        const lines = decoder.decode(value).split("\n");
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.token) {
                fullAnswer += data.token;
                setMessages(prev => {
                  const updated = [...prev];
                  updated[updated.length - 1] = { role: "assistant", content: fullAnswer, streaming: true };
                  return updated;
                });
              }
              if (data.done) {
                setMessages(prev => {
                  const updated = [...prev];
                  updated[updated.length - 1] = { role: "assistant", content: fullAnswer, streaming: false };
                  return updated;
                });
              }
            } catch { continue; }
          }
        }
      }
    } catch {
      setMessages(prev => [...prev.slice(0, -1), { role: "assistant", content: "❌ Error connecting to backend." }]);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (docId: string) => {
    await fetch(`${API}/documents/${docId}?token=${token}`, { method: "DELETE" });
    await fetchDocuments();
    if (selectedDoc?.id === docId) { setSelectedDoc(null); setMessages([]); }
  };

  const handleLogout = () => {
    setToken(""); setUsername(""); setView("auth");
    setDocuments([]); setSelectedDoc(null); setMessages([]);
  };

  // ── Auth Screen ──
  if (view === "auth") return (
    <main className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white">📄 DocSense</h1>
          <p className="text-gray-400 mt-2">AI-powered document Q&A — runs fully locally</p>
        </div>

        <div className="bg-gray-900 rounded-2xl p-8 shadow-2xl border border-gray-800">
          <div className="flex gap-2 mb-6 bg-gray-800 p-1 rounded-xl">
            {["login", "register"].map(mode => (
              <button key={mode} onClick={() => { setAuthMode(mode as "login" | "register"); setAuthError(""); }}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition
                  ${authMode === mode ? "bg-blue-600 text-white shadow" : "text-gray-400 hover:text-white"}`}>
                {mode === "login" ? "Sign In" : "Register"}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {authMode === "register" && (
              <div className="relative">
                <span className="absolute left-3 top-3.5 text-gray-500 text-sm">✉️</span>
                <input type="email" placeholder="Email"
                  value={formData.email}
                  onChange={e => setFormData(p => ({ ...p, email: e.target.value }))}
                  className="w-full bg-gray-800 text-white placeholder-gray-500 rounded-xl pl-9 pr-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500 border border-gray-700" />
              </div>
            )}
            <div className="relative">
              <span className="absolute left-3 top-3.5 text-gray-500 text-sm">👤</span>
              <input type="text" placeholder="Username"
                value={formData.username}
                onChange={e => setFormData(p => ({ ...p, username: e.target.value }))}
                className="w-full bg-gray-800 text-white placeholder-gray-500 rounded-xl pl-9 pr-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500 border border-gray-700" />
            </div>
            <div className="relative">
              <span className="absolute left-3 top-3.5 text-gray-500 text-sm">🔒</span>
              <input type="password" placeholder="Password"
                value={formData.password}
                onChange={e => setFormData(p => ({ ...p, password: e.target.value }))}
                onKeyDown={e => e.key === "Enter" && handleAuth()}
                className="w-full bg-gray-800 text-white placeholder-gray-500 rounded-xl pl-9 pr-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500 border border-gray-700" />
            </div>
          </div>

          {authError && (
            <p className={`text-sm mt-3 px-3 py-2 rounded-lg ${authError.startsWith("✅") ? "bg-green-900/30 text-green-400" : "bg-red-900/30 text-red-400"}`}>
              {authError}
            </p>
          )}

          <button onClick={handleAuth} disabled={authLoading}
            className="w-full mt-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white py-3 rounded-xl text-sm font-semibold transition flex items-center justify-center gap-2">
            {authLoading && <Spinner />}
            {authMode === "login" ? "Sign In" : "Create Account"}
          </button>
        </div>

        <p className="text-center text-xs text-gray-600 mt-6">
          FastAPI · ChromaDB · Ollama · Next.js · JWT Auth
        </p>
      </div>
    </main>
  );

  // ── App Screen ──
  return (
    <main className="min-h-screen bg-gray-950 text-white flex flex-col">

      {/* Navbar */}
      <nav className="border-b border-gray-800 px-6 py-3 flex items-center justify-between bg-gray-900">
        <div className="flex items-center gap-3">
          <span className="text-xl font-bold">📄 DocSense</span>
          <span className="text-xs bg-blue-600 px-2 py-0.5 rounded-full">V2</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-gray-800 px-3 py-1.5 rounded-lg">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span className="text-sm text-gray-300">👤 {username}</span>
          </div>
          <button onClick={handleLogout}
            className="text-sm bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-lg transition text-gray-300">
            Logout
          </button>
        </div>
      </nav>

      <div className="flex flex-1 overflow-hidden">

        {/* Sidebar */}
        <aside className="w-72 border-r border-gray-800 bg-gray-900 flex flex-col">
          <div className="p-4 border-b border-gray-800">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Documents</h2>
              <label className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg cursor-pointer transition font-semibold
                ${uploading ? "bg-gray-700 text-gray-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-500 text-white"}`}>
                {uploading ? <><Spinner /> Processing...</> : <>+ Upload PDF</>}
                <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={handleUpload} disabled={uploading} />
              </label>
            </div>

            {/* Upload Progress */}
            {uploading && <UploadProgress stage={uploadStage} />}
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {documents.length === 0 && !uploading && (
              <div className="text-center py-12">
                <p className="text-3xl mb-2">📂</p>
                <p className="text-xs text-gray-500">No documents yet</p>
                <p className="text-xs text-gray-600 mt-1">Upload a PDF to get started</p>
              </div>
            )}

            {documents.map(doc => (
              <div key={doc.id}
                onClick={() => { setSelectedDoc(doc); setMessages([]); }}
                className={`p-3 rounded-xl cursor-pointer transition group relative border
                  ${selectedDoc?.id === doc.id
                    ? "bg-blue-600 border-blue-500"
                    : "bg-gray-800 hover:bg-gray-750 border-gray-700 hover:border-gray-600"}`}>
                <div className="flex items-start gap-2 pr-6">
                  <span className="text-lg shrink-0">📄</span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{doc.filename}</p>
                    <p className={`text-xs mt-0.5 ${selectedDoc?.id === doc.id ? "text-blue-200" : "text-gray-500"}`}>
                      {doc.chunk_count} chunks · {new Date(doc.uploaded_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <button
                  onClick={e => { e.stopPropagation(); handleDelete(doc.id); }}
                  className="absolute top-2.5 right-2.5 w-5 h-5 flex items-center justify-center text-gray-500 hover:text-red-400 text-xs opacity-0 group-hover:opacity-100 transition rounded">
                  ✕
                </button>
              </div>
            ))}
          </div>
        </aside>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col bg-gray-950">
          {!selectedDoc ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <p className="text-6xl mb-4">🔍</p>
                <p className="text-xl font-semibold text-gray-300">Select a document</p>
                <p className="text-sm text-gray-500 mt-2">Choose from the sidebar or upload a new PDF</p>
                <div className="mt-8 grid grid-cols-3 gap-4 max-w-md mx-auto">
                  {["Upload PDF", "Ask Questions", "Get Answers"].map((step, i) => (
                    <div key={step} className="bg-gray-900 rounded-xl p-4 border border-gray-800">
                      <p className="text-2xl mb-2">{["📤", "💬", "🧠"][i]}</p>
                      <p className="text-xs text-gray-400">{step}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Doc Header */}
              <div className="border-b border-gray-800 px-6 py-3 flex items-center gap-3 bg-gray-900">
                <span className="text-xl">📄</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{selectedDoc.filename}</p>
                  <p className="text-xs text-gray-400">{selectedDoc.chunk_count} semantic chunks · Ready to answer</p>
                </div>
                <div className="flex items-center gap-1.5 bg-green-900/30 border border-green-800 px-3 py-1 rounded-full">
                  <div className="w-1.5 h-1.5 bg-green-400 rounded-full" />
                  <span className="text-xs text-green-400 font-medium">Active</span>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {messages.length === 0 && (
                  <div className="text-center py-12">
                    <p className="text-4xl mb-3">💬</p>
                    <p className="text-gray-400">Ask anything about this document</p>
                    <p className="text-xs text-gray-600 mt-1">Answers are grounded in your document only</p>
                  </div>
                )}

                {messages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`flex items-end gap-2 max-w-[80%] ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 shadow
                        ${msg.role === "user" ? "bg-blue-600" : "bg-gradient-to-br from-purple-600 to-purple-800"}`}>
                        {msg.role === "user" ? "You" : "AI"}
                      </div>
                      <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap shadow
                        ${msg.role === "user"
                          ? "bg-blue-600 text-white rounded-br-sm"
                          : "bg-gray-800 text-gray-100 rounded-bl-sm border border-gray-700"}`}>
                        {msg.content || (msg.streaming && (
                          <div className="flex space-x-1 items-center h-4">
                            <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
                            <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
                            <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
                          </div>
                        ))}
                        {msg.streaming && msg.content && (
                          <span className="inline-block w-0.5 h-4 bg-purple-400 ml-0.5 animate-pulse" />
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>

              {/* Input */}
              <div className="border-t border-gray-800 p-4 bg-gray-900">
                <div className="flex gap-3 items-center">
                  <input type="text" value={question}
                    onChange={e => setQuestion(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleAsk()}
                    placeholder="Ask anything about your document..."
                    disabled={loading}
                    className="flex-1 bg-gray-800 text-white placeholder-gray-500 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50 border border-gray-700" />
                  <button onClick={handleAsk} disabled={loading || !question.trim()}
                    className="bg-purple-700 hover:bg-purple-600 disabled:opacity-40 disabled:cursor-not-allowed px-5 py-3 rounded-xl text-sm font-semibold transition flex items-center gap-2 shrink-0">
                    {loading ? <><Spinner /> Thinking...</> : "Ask →"}
                  </button>
                </div>
                <p className="text-xs text-gray-600 mt-2 text-center">
                  Answers grounded in document · Streaming · Local LLM
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}