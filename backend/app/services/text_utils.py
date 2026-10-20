"""
Nexo - Utilidades de texto: normalización, tokenización y ranking BM25.
Sin dependencias externas; se usa para sugerir agentes y para el RAG de documentos.
"""

from __future__ import annotations

import math
import re
import unicodedata
from collections import Counter
from typing import Dict, Iterable, List, Sequence, Tuple

STOPWORDS = frozenset({
    # español
    "de", "la", "el", "los", "las", "un", "una", "unos", "unas", "y", "o", "u", "en", "para", "por", "con",
    "sin", "que", "mi", "mis", "me", "a", "al", "del", "como", "quiero", "necesito", "hacer", "crear", "sobre",
    "es", "son", "se", "lo", "le", "les", "su", "sus", "mas", "pero", "este", "esta", "esto", "estos", "estas",
    "ese", "esa", "eso", "hay", "muy", "ya", "tambien", "entre", "cuando", "donde", "cual", "cuales", "porque",
    "sea", "ser", "tiene", "tengo", "puede", "puedo", "todo", "todos", "toda", "todas", "otro", "otra",
    # inglés
    "the", "and", "for", "to", "of", "my", "i", "need", "want", "how", "with", "is", "are", "be", "this",
    "that", "it", "in", "on", "an", "or", "as", "by", "at", "from", "can", "what", "which", "your", "you",
})


def normalize(text: str) -> str:
    text = unicodedata.normalize("NFKD", text.lower())
    return "".join(c for c in text if not unicodedata.combining(c))


def tokenize(text: str) -> List[str]:
    return [t for t in re.findall(r"[a-z0-9]{3,}", normalize(text)) if t not in STOPWORDS]


class BM25:
    """Índice BM25 en memoria sobre una lista de documentos (strings)."""

    def __init__(self, documents: Sequence[str], k1: float = 1.5, b: float = 0.75):
        self.k1, self.b = k1, b
        self.docs = [Counter(tokenize(d)) for d in documents]
        self.lengths = [sum(c.values()) for c in self.docs]
        self.avg_len = (sum(self.lengths) / len(self.lengths)) if self.lengths else 0.0
        df: Counter = Counter()
        for counts in self.docs:
            df.update(counts.keys())
        n = len(self.docs)
        self.idf: Dict[str, float] = {t: math.log(1 + (n - f + 0.5) / (f + 0.5)) for t, f in df.items()}

    def scores(self, query: str) -> List[float]:
        terms = tokenize(query)
        result = []
        for counts, length in zip(self.docs, self.lengths):
            score = 0.0
            for term in terms:
                tf = counts.get(term)
                if not tf:
                    continue
                denom = tf + self.k1 * (1 - self.b + self.b * length / (self.avg_len or 1))
                score += self.idf.get(term, 0.0) * tf * (self.k1 + 1) / denom
            result.append(score)
        return result

    def top(self, query: str, k: int) -> List[Tuple[int, float]]:
        ranked = sorted(enumerate(self.scores(query)), key=lambda x: -x[1])
        return [(i, s) for i, s in ranked[:k] if s > 0]


def chunk_text(text: str, size: int = 1200, overlap: int = 150) -> List[str]:
    """Divide en fragmentos de ~size caracteres respetando párrafos cuando es posible."""
    text = re.sub(r"[ \t]+", " ", text).strip()
    if not text:
        return []
    paragraphs = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]
    chunks: List[str] = []
    current = ""
    for para in paragraphs:
        while len(para) > size:  # párrafo gigante: cortar duro con solapamiento
            if current:
                chunks.append(current)
                current = ""
            chunks.append(para[:size])
            para = para[size - overlap:]
        if len(current) + len(para) + 2 <= size:
            current = f"{current}\n\n{para}" if current else para
        else:
            if current:
                chunks.append(current)
            tail = current[-overlap:] if current else ""
            current = f"{tail}\n\n{para}" if tail else para
    if current:
        chunks.append(current)
    return chunks


def unique_by(items: Iterable[dict], key: str) -> List[dict]:
    seen, out = set(), []
    for item in items:
        value = item.get(key)
        if value and value not in seen:
            seen.add(value)
            out.append(item)
    return out
