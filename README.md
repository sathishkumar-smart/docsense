# 📄 DocSense V2

AI-powered document Q&A — upload any PDF and chat with it.
Built with FastAPI + ChromaDB + Sentence Transformers + Ollama + Next.js.

## What's New in V2
- 🔐 JWT Authentication — register/login, each user sees only their documents
- 🧩 Semantic Chunking — splits by sentences using NLTK, not arbitrary characters
- ⚡ Streaming Responses — answers appear word by word like ChatGPT
- 📊 Upload Progress — step by step visual feedback during processing
- 🗂️ Document Manager — sidebar with all your docs, delete anytime
- 🏗️ Production Structure — routers, models, utils separated properly

## Tech Stack
- **Backend:** Python, FastAPI, SQLAlchemy (SQLite)
- **Vector DB:** ChromaDB (persistent local storage)
- **Embeddings:** Sentence Transformers (all-MiniLM-L6-v2, 6-layer transformer)
- **AI:** Ollama — runs fully locally, no API key needed
  > Swap any model by changing `OLLAMA_MODEL` in `backend/.env`
- **Frontend:** Next.js (React, TypeScript, Tailwind CSS)
- **Auth:** JWT tokens via python-jose + bcrypt password hashing

## How It Works
```
PDF Upload → Extract Text → Semantic Chunk (NLTK) → Embeddings → ChromaDB
                                                                      ↓
User Question → Embed Question → ChromaDB Similarity Search → Top 4 Chunks
                                                                      ↓
                              Prompt + Context → Ollama → Streaming Response
```

## Project Structure
```
docsense/
├── backend/
│   ├── main.py              # FastAPI app entry point
│   ├── routers/
│   │   ├── auth.py          # Register, login, JWT
│   │   ├── documents.py     # Upload, list, delete docs
│   │   └── chat.py          # Ask + streaming ask
│   ├── models/
│   │   ├── database.py      # SQLAlchemy models (User, Document)
│   │   └── schemas.py       # Pydantic schemas
│   ├── utils/
│   │   ├── chunking.py      # Semantic chunking with NLTK
│   │   └── embeddings.py    # ChromaDB operations
│   └── requirements.txt
└── frontend/
    └── app/
        └── page.tsx         # Full app UI (auth + chat + document manager)
```

## How to Run

### Prerequisites
- Python 3.10+
- Node.js 18+
- [Ollama](https://ollama.ai) installed and running locally

### 1. Start Ollama
```bash
ollama run tinyllama
```

### 2. Backend
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### 3. Frontend
```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## API Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register` | Create account |
| POST | `/auth/login` | Login → JWT token |
| POST | `/documents/upload` | Upload PDF (auth required) |
| GET | `/documents/` | List user's documents |
| DELETE | `/documents/{id}` | Delete document |
| POST | `/chat/ask` | Ask question (full response) |
| POST | `/chat/ask/stream` | Ask question (streaming) |