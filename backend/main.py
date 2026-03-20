from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import chromadb
from chromadb.utils import embedding_functions
from pypdf import PdfReader
import httpx
import os
import uuid
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="DocSense API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "tinyllama")
CHROMA_DB_PATH = os.getenv("CHROMA_DB_PATH", "./chromadb_store")

# ── ChromaDB Setup ──
chroma_client = chromadb.PersistentClient(path=CHROMA_DB_PATH)
embedding_fn = embedding_functions.SentenceTransformerEmbeddingFunction(
    model_name="all-MiniLM-L6-v2"
)


# ── Models ──
class QuestionRequest(BaseModel):
    question: str
    collection_name: str

class QuestionResponse(BaseModel):
    answer: str
    sources: list[str]
    model: str


# ── Helpers ──
def extract_text_from_pdf(file_bytes: bytes) -> str:
    """Extract all text from a PDF file."""
    import io
    reader = PdfReader(io.BytesIO(file_bytes))
    text = ""
    for page in reader.pages:
        text += page.extract_text() or ""
    return text


def chunk_text(text: str, chunk_size: int = 500, overlap: int = 50) -> list[str]:
    """Split text into overlapping chunks for better context."""
    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        chunks.append(text[start:end])
        start = end - overlap
    return chunks


# ── Routes ──
@app.get("/")
def health_check():
    return {"status": "running", "model": OLLAMA_MODEL}


@app.post("/upload")
async def upload_document(file: UploadFile = File(...)):
    """
    Upload a PDF → extract text → chunk it →
    store embeddings in ChromaDB
    """
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files supported")

    # Read file
    file_bytes = await file.read()

    # Extract text
    text = extract_text_from_pdf(file_bytes)
    if not text.strip():
        raise HTTPException(status_code=400, detail="Could not extract text from PDF")

    # Chunk text
    chunks = chunk_text(text)

    # Create a collection named after the file
    collection_name = file.filename.replace(".pdf", "").replace(" ", "_").lower()

    # Delete if exists (re-upload = refresh)
    try:
        chroma_client.delete_collection(collection_name)
    except:
        pass

    collection = chroma_client.create_collection(
        name=collection_name,
        embedding_function=embedding_fn
    )

    # Store chunks with embeddings
    collection.add(
        documents=chunks,
        ids=[str(uuid.uuid4()) for _ in chunks]
    )

    return {
        "message": "Document uploaded successfully",
        "filename": file.filename,
        "collection_name": collection_name,
        "chunks": len(chunks)
    }


@app.post("/ask", response_model=QuestionResponse)
async def ask_question(request: QuestionRequest):
    """
    Take a question → search ChromaDB for relevant chunks →
    send context + question to Ollama → return answer
    """
    # Get collection
    try:
        collection = chroma_client.get_collection(
            name=request.collection_name,
            embedding_function=embedding_fn
        )
    except:
        raise HTTPException(status_code=404, detail="Document not found. Please upload first.")

    # Find most relevant chunks
    results = collection.query(
        query_texts=[request.question],
        n_results=3
    )

    relevant_chunks = results["documents"][0]
    context = "\n\n".join(relevant_chunks)

    # Build prompt
    prompt = f"""You are a helpful assistant. Answer the question based ONLY on the context provided below.
If the answer is not in the context, say "I could not find this information in the document."

Context:
{context}

Question: {request.question}

Answer:"""

    # Call Ollama
    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            f"{OLLAMA_BASE_URL}/api/generate",
            json={
                "model": OLLAMA_MODEL,
                "prompt": prompt,
                "stream": False
            }
        )
        response.raise_for_status()
        data = response.json()

    answer = data["response"]

    return QuestionResponse(
        answer=answer,
        sources=relevant_chunks,
        model=OLLAMA_MODEL
    )


@app.get("/documents")
def list_documents():
    """List all uploaded documents."""
    collections = chroma_client.list_collections()
    return {"documents": [col.name for col in collections]}


@app.delete("/documents/{collection_name}")
def delete_document(collection_name: str):
    """Delete a document from the database."""
    try:
        chroma_client.delete_collection(collection_name)
        return {"message": f"{collection_name} deleted successfully"}
    except:
        raise HTTPException(status_code=404, detail="Document not found")