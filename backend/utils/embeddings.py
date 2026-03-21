import chromadb
from chromadb.utils import embedding_functions
import os

CHROMA_DB_PATH = os.getenv("CHROMA_DB_PATH", "./chromadb_store")

# Single shared instance
chroma_client = chromadb.PersistentClient(path=CHROMA_DB_PATH)
embedding_fn = embedding_functions.SentenceTransformerEmbeddingFunction(
    model_name="all-MiniLM-L6-v2"
)


def get_or_create_collection(collection_name: str):
    return chroma_client.get_or_create_collection(
        name=collection_name,
        embedding_function=embedding_fn
    )


def delete_collection(collection_name: str):
    try:
        chroma_client.delete_collection(collection_name)
    except Exception:
        pass


def search_collection(collection_name: str, query: str, n_results: int = 4):
    collection = chroma_client.get_collection(
        name=collection_name,
        embedding_function=embedding_fn
    )
    results = collection.query(
        query_texts=[query],
        n_results=n_results
    )
    return results["documents"][0]


def list_collections():
    return [col.name for col in chroma_client.list_collections()]
