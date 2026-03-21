from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from models.database import create_tables
from routers import auth, documents, chat
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(
    title="DocSense API V2",
    description="AI-powered document Q&A with JWT auth, semantic chunking and streaming",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create DB tables on startup
@app.on_event("startup")
def startup():
    create_tables()

# Register routers
app.include_router(auth.router)
app.include_router(documents.router)
app.include_router(chat.router)

@app.get("/")
def health_check():
    return {
        "status": "running",
        "version": "2.0.0",
        "features": ["jwt-auth", "semantic-chunking", "streaming", "background-tasks"]
    }