from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, BackgroundTasks
from sqlalchemy.orm import Session
from models.database import get_db, Document
from models.schemas import DocumentResponse, UploadResponse
from routers.auth import get_current_user
from utils.chunking import semantic_chunk
from utils.embeddings import get_or_create_collection, delete_collection, list_collections
from pypdf import PdfReader
import uuid
import io
import re

router = APIRouter(prefix="/documents", tags=["Documents"])


def extract_text(file_bytes: bytes) -> str:
    reader = PdfReader(io.BytesIO(file_bytes))
    text = ""
    for page in reader.pages:
        text += page.extract_text() or ""
    return text


def process_document(file_bytes: bytes, collection_name: str, chunks_holder: list):
    """Runs in background — extracts, chunks, embeds document."""
    text = extract_text(file_bytes)
    chunks = semantic_chunk(text)
    collection = get_or_create_collection(collection_name)
    collection.add(
        documents=chunks,
        ids=[str(uuid.uuid4()) for _ in chunks]
    )
    chunks_holder.append(len(chunks))


@router.post("/upload", response_model=UploadResponse)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    token: str = "",
    db: Session = Depends(get_db)
):
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files supported")

    # Auth
    user = get_current_user(token, db)

    # Read file
    file_bytes = await file.read()

    # Extract text immediately to get chunk count
    text = extract_text(file_bytes)
    if not text.strip():
        raise HTTPException(status_code=400, detail="Could not extract text from PDF")

    # Create collection name namespaced to user
    base_name = file.filename.replace(".pdf", "").lower()
    base_name = re.sub(r'[^a-z0-9]', '_', base_name)  # replace ALL invalid chars
    base_name = re.sub(r'_+', '_', base_name)           # remove double underscores
    base_name = base_name.strip('_')                    # remove leading/trailing _
    collection_name = f"u{user.id[:8]}_{base_name}"    # prefix with 'u' ensures starts with letter
    # Delete old version if exists
    delete_collection(collection_name)

    # Get chunks for metadata
    chunks = semantic_chunk(text)

    # Store document metadata in SQLite
    doc = Document(
        id=str(uuid.uuid4()),
        filename=file.filename,
        collection_name=collection_name,
        chunk_count=len(chunks),
        user_id=user.id
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    # Store embeddings in background
    collection = get_or_create_collection(collection_name)
    collection.add(
        documents=chunks,
        ids=[str(uuid.uuid4()) for _ in chunks]
    )

    return UploadResponse(message="Document uploaded! Embeddings processing in background.", document=doc)


@router.get("/", response_model=list[DocumentResponse])
def list_documents(token: str = "", db: Session = Depends(get_db)):
    user = get_current_user(token, db)
    docs = db.query(Document).filter(Document.user_id == user.id).all()
    return docs


@router.delete("/{document_id}")
def delete_document(document_id: str, token: str = "", db: Session = Depends(get_db)):
    user = get_current_user(token, db)
    doc = db.query(Document).filter(
        Document.id == document_id,
        Document.user_id == user.id
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    delete_collection(doc.collection_name)
    db.delete(doc)
    db.commit()
    return {"message": f"{doc.filename} deleted successfully"}
