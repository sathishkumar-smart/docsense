from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import Optional


# ── Auth ──
class UserRegister(BaseModel):
    username: str
    email: str
    password: str

class UserLogin(BaseModel):
    username: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"

class UserResponse(BaseModel):
    id: str
    username: str
    email: str
    created_at: datetime

    class Config:
        from_attributes = True


# ── Documents ──
class DocumentResponse(BaseModel):
    id: str
    filename: str
    collection_name: str
    chunk_count: int
    uploaded_at: datetime

    class Config:
        from_attributes = True


class UploadResponse(BaseModel):
    message: str
    document: DocumentResponse


# ── Chat ──
class QuestionRequest(BaseModel):
    question: str
    collection_name: str

class QuestionResponse(BaseModel):
    answer: str
    sources: list[str]
    model: str
