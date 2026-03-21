import nltk
import re

# Download required NLTK data
try:
    nltk.data.find('tokenizers/punkt_tab')
except LookupError:
    nltk.download('punkt_tab')


def semantic_chunk(text: str, max_chunk_size: int = 500, overlap_sentences: int = 1) -> list[str]:
    """
    Semantic chunking — splits by sentences instead of characters.
    Each chunk contains complete sentences — no meaning is cut in half.
    Overlap is measured in sentences, not characters.
    """
    # Clean text
    text = re.sub(r'\s+', ' ', text).strip()

    # Split into sentences
    sentences = nltk.sent_tokenize(text)

    chunks = []
    current_chunk = []
    current_size = 0

    for sentence in sentences:
        sentence_size = len(sentence)

        # If adding this sentence exceeds max size, save current chunk
        if current_size + sentence_size > max_chunk_size and current_chunk:
            chunks.append(' '.join(current_chunk))
            # Keep last N sentences as overlap for next chunk
            current_chunk = current_chunk[-overlap_sentences:]
            current_size = sum(len(s) for s in current_chunk)

        current_chunk.append(sentence)
        current_size += sentence_size

    # Add remaining sentences
    if current_chunk:
        chunks.append(' '.join(current_chunk))

    return chunks
