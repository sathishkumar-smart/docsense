# 📄 DocSense

Upload any PDF and ask questions — AI answers directly from your document.
Built with FastAPI + ChromaDB + Ollama + Next.js.

## Tech Stack
- **Backend:** Python, FastAPI
- **Vector DB:** ChromaDB (local embeddings storage)
- **Embeddings:** Sentence Transformers (all-MiniLM-L6-v2)
- **AI:** Ollama (TinyLlama — runs fully locally, no API key needed)
  > Swap any model by changing `OLLAMA_MODEL` in `backend/.env`
- **Frontend:** Next.js (React, TypeScript, Tailwind CSS)

## Features
- 📤 Upload any PDF document
- 🔍 Semantic search — finds most relevant chunks from document
- 🧠 AI answers based ONLY on your document content
- 🔒 Runs 100% locally — your documents never leave your machine
- ⚡ FastAPI async backend
- 🎨 Clean dark UI

## How It Works
```
PDF Upload → Extract Text → Chunk Text → Generate Embeddings → Store in ChromaDB
                                                                        ↓
User Question → Generate Embedding → Search ChromaDB → Get Top 3 Chunks
                                                                        ↓
                                            Send Context + Question to Ollama → Answer
```

## Project Structure
```
docsense/
├── backend/
│   ├── main.py              # FastAPI app
│   ├── .env                 # Config
│   ├── requirements.txt
│   └── chromadb_store/      # Local vector DB (auto created)
└── frontend/
    └── app/
        └── page.tsx         # Chat UI
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
| GET | `/` | Health check |
| POST | `/upload` | Upload PDF document |
| POST | `/ask` | Ask question about document |
| GET | `/documents` | List all uploaded documents |
| DELETE | `/documents/{name}` | Delete a document |