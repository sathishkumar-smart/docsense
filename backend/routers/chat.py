from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from models.database import get_db, Document
from models.schemas import QuestionRequest, QuestionResponse
from routers.auth import get_current_user
from utils.embeddings import search_collection
import httpx
import os
import json

router = APIRouter(prefix="/chat", tags=["Chat"])

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "tinyllama")


@router.post("/ask", response_model=QuestionResponse)
async def ask_question(request: QuestionRequest, token: str = "", db: Session = Depends(get_db)):
    """Standard ask — returns full answer at once."""
    user = get_current_user(token, db)

    # Verify document belongs to user
    doc = db.query(Document).filter(
        Document.collection_name == request.collection_name,
        Document.user_id == user.id
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # Search ChromaDB
    relevant_chunks = search_collection(request.collection_name, request.question)
    context = "\n\n".join(relevant_chunks)

    prompt = f"""You are a helpful assistant. Answer the question based ONLY on the context below.
If the answer is not in the context, say "I could not find this information in the document."

Context:
{context}

Question: {request.question}

Answer:"""

    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            f"{OLLAMA_BASE_URL}/api/generate",
            json={"model": OLLAMA_MODEL, "prompt": prompt, "stream": False}
        )
        response.raise_for_status()
        data = response.json()

    return QuestionResponse(
        answer=data["response"],
        sources=relevant_chunks,
        model=OLLAMA_MODEL
    )


@router.post("/ask/stream")
async def ask_stream(request: QuestionRequest, token: str = "", db: Session = Depends(get_db)):
    """Streaming ask — returns tokens word by word like ChatGPT."""
    user = get_current_user(token, db)

    # Verify document belongs to user
    doc = db.query(Document).filter(
        Document.collection_name == request.collection_name,
        Document.user_id == user.id
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # Search ChromaDB
    relevant_chunks = search_collection(request.collection_name, request.question)
    context = "\n\n".join(relevant_chunks)

    prompt = f"""You are a helpful assistant. Answer the question based ONLY on the context below.
If the answer is not in the context, say "I could not find this information in the document."

Context:
{context}

Question: {request.question}

Answer:"""

    async def generate():
        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream(
                "POST",
                f"{OLLAMA_BASE_URL}/api/generate",
                json={"model": OLLAMA_MODEL, "prompt": prompt, "stream": True}
            ) as response:
                async for line in response.aiter_lines():
                    if line:
                        try:
                            data = json.loads(line)
                            token_text = data.get("response", "")
                            if token_text:
                                yield f"data: {json.dumps({'token': token_text})}\n\n"
                            if data.get("done"):
                                yield f"data: {json.dumps({'done': True})}\n\n"
                                break
                        except json.JSONDecodeError:
                            continue

    return StreamingResponse(generate(), media_type="text/event-stream")
