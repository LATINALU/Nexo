"""
Nexo - Documentos adjuntos (RAG)
================================
El usuario sube archivos; se extrae el texto, se divide en fragmentos y en cada
consulta se recuperan los más relevantes (BM25) para dárselos a los agentes.

Almacenamiento: PostgreSQL si está disponible; si no, memoria del proceso (24 h).
Acceso: el id del documento es un UUID aleatorio (capacidad). Si el documento
pertenece a un usuario registrado, además se exige ser ese usuario.
"""

from __future__ import annotations

import io
import json
import logging
import math
import time
import uuid
from dataclasses import dataclass, field
from typing import Dict, List, Optional

from app.services.ocr import IMAGE_EXTENSIONS, OCRError, _normalize_image, ocr_images, pdf_page_images
from app.services.text_utils import BM25, chunk_text

logger = logging.getLogger("nexo.documents")

MAX_FILE_BYTES = 10 * 1024 * 1024
MAX_DOCUMENT_CHARS = 300_000
MAX_DOCUMENTS_PER_RUN = 5
MAX_CONTEXT_CHARS = 7000
TOP_CHUNKS = 6
_MEMORY_TTL_S = 24 * 3600
_MEMORY_MAX_DOCS = 200

TEXT_EXTENSIONS = (".pdf", ".docx", ".txt", ".md", ".markdown", ".csv", ".json", ".html", ".htm", ".log")
SUPPORTED_EXTENSIONS = TEXT_EXTENSIONS + IMAGE_EXTENSIONS


class DocumentError(ValueError):
    """Error presentable al usuario."""


class NeedsOCR(DocumentError):
    """El archivo es una imagen o un PDF escaneado: requiere OCR."""


@dataclass
class Document:
    id: str
    name: str
    mime: str
    size: int
    owner_id: Optional[str]
    chunks: List[str]
    created_at: float = field(default_factory=time.time)
    ocr: bool = False

    @property
    def char_count(self) -> int:
        return sum(len(c) for c in self.chunks)

    def public(self) -> Dict:
        return {"id": self.id, "name": self.name, "mime": self.mime, "size": self.size,
                "chunks": len(self.chunks), "chars": self.char_count, "ocr": self.ocr}


# ----------------------------------------------------------------- extracción

def extract_text(filename: str, data: bytes) -> str:
    name = filename.lower()
    if not name.endswith(SUPPORTED_EXTENSIONS):
        raise DocumentError(f"Formato no soportado. Usa: {', '.join(SUPPORTED_EXTENSIONS)}")
    if name.endswith(IMAGE_EXTENSIONS):
        raise NeedsOCR("Las imágenes requieren OCR")
    if name.endswith(".pdf"):
        try:
            from pypdf import PdfReader
        except ImportError:
            raise DocumentError("Soporte PDF no instalado (pypdf)")
        try:
            reader = PdfReader(io.BytesIO(data))
            text = "\n\n".join((page.extract_text() or "") for page in reader.pages)
        except Exception as e:
            raise DocumentError(f"No se pudo leer el PDF: {e}"[:200])
        if len(text.strip()) < 5 * max(1, len(reader.pages)):  # < ~5 caracteres por página: escaneo
            raise NeedsOCR("El PDF no tiene texto extraíble (¿es un escaneo?)")
        return text
    if name.endswith(".docx"):
        try:
            import docx
        except ImportError:
            raise DocumentError("Soporte DOCX no instalado (python-docx)")
        try:
            document = docx.Document(io.BytesIO(data))
        except Exception as e:
            raise DocumentError(f"No se pudo leer el DOCX: {e}"[:200])
        parts = [p.text for p in document.paragraphs]
        for table in document.tables:
            for row in table.rows:
                parts.append(" | ".join(cell.text for cell in row.cells))
        return "\n\n".join(parts)
    for encoding in ("utf-8", "utf-16", "latin-1"):
        try:
            text = data.decode(encoding)
            break
        except UnicodeDecodeError:
            continue
    if name.endswith((".html", ".htm")):
        import re
        text = re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", text, flags=re.S | re.I)
        text = re.sub(r"<[^>]+>", " ", text)
    if name.endswith(".json"):
        try:
            text = json.dumps(json.loads(text), ensure_ascii=False, indent=1)
        except ValueError:
            pass
    return text


async def build_document(filename: str, mime: str, data: bytes, owner_id: Optional[str],
                         ocr_llm=None, language: str = "es") -> Document:
    """
    Extrae el texto y lo fragmenta. Imágenes y PDFs escaneados pasan por OCR
    (modelo con visión del usuario o Tesseract local).
    """
    if len(data) > MAX_FILE_BYTES:
        raise DocumentError(f"El archivo supera {MAX_FILE_BYTES // (1024 * 1024)} MB")
    if not data:
        raise DocumentError("El archivo está vacío")
    used_ocr = False
    try:
        text = extract_text(filename, data)
    except NeedsOCR as needs:
        try:
            images = pdf_page_images(data) if filename.lower().endswith(".pdf") else [_normalize_image(data)]
            if not images:
                raise DocumentError(f"{needs} y no contiene imágenes legibles")
            pages = await ocr_images(images, ocr_llm, language)
        except OCRError as e:
            raise DocumentError(str(e))
        text = "\n\n".join(f"--- Página {i + 1} ---\n{t}" if len(pages) > 1 else t
                            for i, t in enumerate(pages) if t.strip())
        used_ocr = True
    text = text[:MAX_DOCUMENT_CHARS]
    chunks = chunk_text(text)
    if not chunks:
        raise DocumentError("No se encontró texto en el archivo")
    safe_name = (filename.replace("\\", "/").split("/")[-1] or "documento")[:200]
    return Document(id=str(uuid.uuid4()), name=safe_name, mime=(mime or "")[:100], size=len(data),
                    owner_id=owner_id, chunks=chunks, ocr=used_ocr)


# ---------------------------------------------------------------- almacenamiento

class DocumentStore:

    def __init__(self):
        self._memory: Dict[str, Document] = {}
        self._memory_vectors: Dict[tuple, List[List[float]]] = {}

    @property
    def _pool(self):
        from app.pg_database import pg_db
        return pg_db._pool

    def _purge_memory(self) -> None:
        now = time.time()
        for doc_id in [d.id for d in self._memory.values() if now - d.created_at > _MEMORY_TTL_S]:
            self._memory.pop(doc_id, None)
        while len(self._memory) > _MEMORY_MAX_DOCS:
            oldest = min(self._memory.values(), key=lambda d: d.created_at)
            self._memory.pop(oldest.id, None)
        for key in [k for k in self._memory_vectors if k[0] not in self._memory]:
            self._memory_vectors.pop(key, None)

    async def save(self, doc: Document) -> None:
        if self._pool:
            async with self._pool.acquire() as conn, conn.transaction():
                await conn.execute("""
                    INSERT INTO public.nexo_documents (id, owner_id, name, mime, size, char_count, chunk_count)
                    VALUES ($1, $2, $3, $4, $5, $6, $7)
                """, uuid.UUID(doc.id), uuid.UUID(doc.owner_id) if doc.owner_id else None, doc.name, doc.mime,
                    doc.size, doc.char_count, len(doc.chunks))
                await conn.executemany(
                    "INSERT INTO public.nexo_document_chunks (document_id, ord, content) VALUES ($1, $2, $3)",
                    [(uuid.UUID(doc.id), i, c) for i, c in enumerate(doc.chunks)])
            return
        self._memory[doc.id] = doc
        self._purge_memory()

    async def get(self, doc_id: str, user_id: Optional[str]) -> Optional[Document]:
        try:
            uid = uuid.UUID(doc_id)
        except (ValueError, TypeError):
            return None
        if self._pool:
            async with self._pool.acquire() as conn:
                row = await conn.fetchrow("SELECT * FROM public.nexo_documents WHERE id = $1", uid)
                if not row:
                    return None
                owner = str(row["owner_id"]) if row["owner_id"] else None
                if owner and owner != user_id:
                    return None
                chunks = await conn.fetch(
                    "SELECT content FROM public.nexo_document_chunks WHERE document_id = $1 ORDER BY ord", uid)
            return Document(id=doc_id, name=row["name"], mime=row["mime"] or "", size=row["size"],
                            owner_id=owner, chunks=[c["content"] for c in chunks],
                            created_at=row["created_at"].timestamp())
        doc = self._memory.get(str(uid))
        if not doc or (doc.owner_id and doc.owner_id != user_id):
            return None
        return doc

    async def list_for_user(self, user_id: str) -> List[Dict]:
        if self._pool:
            async with self._pool.acquire() as conn:
                rows = await conn.fetch("""
                    SELECT id, name, mime, size, chunk_count, char_count FROM public.nexo_documents
                    WHERE owner_id = $1 ORDER BY created_at DESC LIMIT 200
                """, uuid.UUID(user_id))
            return [{"id": str(r["id"]), "name": r["name"], "mime": r["mime"], "size": r["size"],
                     "chunks": r["chunk_count"], "chars": r["char_count"]} for r in rows]
        return [d.public() for d in self._memory.values() if d.owner_id == user_id]

    async def delete(self, doc_id: str, user_id: Optional[str]) -> bool:
        doc = await self.get(doc_id, user_id)
        if not doc:
            return False
        if self._pool:
            async with self._pool.acquire() as conn:
                await conn.execute("DELETE FROM public.nexo_documents WHERE id = $1", uuid.UUID(doc_id))
        else:
            self._memory.pop(doc_id, None)
            for key in [k for k in self._memory_vectors if k[0] == doc_id]:
                self._memory_vectors.pop(key, None)
        return True

    async def get_vectors(self, doc_id: str, model: str) -> Optional[List[List[float]]]:
        if self._pool:
            async with self._pool.acquire() as conn:
                rows = await conn.fetch("""
                    SELECT embedding FROM public.nexo_document_embeddings
                    WHERE document_id = $1 AND model = $2 ORDER BY ord
                """, uuid.UUID(doc_id), model)
            return [list(r["embedding"]) for r in rows] or None
        return self._memory_vectors.get((doc_id, model))

    async def save_vectors(self, doc_id: str, model: str, vectors: List[List[float]]) -> None:
        if self._pool:
            async with self._pool.acquire() as conn, conn.transaction():
                await conn.execute("DELETE FROM public.nexo_document_embeddings WHERE document_id = $1 AND model = $2",
                                   uuid.UUID(doc_id), model)
                await conn.executemany(
                    "INSERT INTO public.nexo_document_embeddings (document_id, model, ord, embedding) VALUES ($1, $2, $3, $4)",
                    [(uuid.UUID(doc_id), model, i, v) for i, v in enumerate(vectors)])
            return
        self._memory_vectors[(doc_id, model)] = vectors


document_store = DocumentStore()


# ------------------------------------------------------------------ retrieval

async def load_documents(doc_ids: List[str], user_id: Optional[str]) -> List[Document]:
    docs = []
    for doc_id in list(dict.fromkeys(doc_ids))[:MAX_DOCUMENTS_PER_RUN]:
        doc = await document_store.get(str(doc_id), user_id)
        if doc:
            docs.append(doc)
    return docs


RRF_K = 60


def _cosine(a: List[float], b: List[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    return dot / (na * nb) if na and nb else 0.0


def _fuse(rankings: List[List[int]], k: int) -> List[int]:
    """Reciprocal Rank Fusion: combina rankings sin tener que calibrar sus puntajes."""
    scores: Dict[int, float] = {}
    for ranking in rankings:
        for rank, idx in enumerate(ranking):
            scores[idx] = scores.get(idx, 0.0) + 1.0 / (RRF_K + rank + 1)
    return [i for i, _ in sorted(scores.items(), key=lambda x: -x[1])[:k]]


class Embedder:
    """Embeddings del proveedor del usuario, con caché por documento y modelo."""

    def __init__(self, llm, model: str):
        self.llm, self.model = llm, model

    async def chunk_vectors(self, doc: Document) -> List[List[float]]:
        cached = await document_store.get_vectors(doc.id, self.model)
        if cached and len(cached) == len(doc.chunks):
            return cached
        vectors = await self.llm.embed(doc.chunks, self.model)
        await document_store.save_vectors(doc.id, self.model, vectors)
        return vectors

    async def query_vector(self, query: str) -> List[float]:
        return (await self.llm.embed([query], self.model))[0]


async def semantic_ranking(query: str, docs: List[Document], embedder: Embedder, limit: int) -> List[int]:
    """Índices (sobre los fragmentos aplanados de `docs`) ordenados por similitud coseno."""
    vectors: List[List[float]] = []
    for doc in docs:
        vectors.extend(await embedder.chunk_vectors(doc))
    q = await embedder.query_vector(query)
    scored = sorted(range(len(vectors)), key=lambda i: -_cosine(q, vectors[i]))
    return scored[:limit]


def retrieve(query: str, docs: List[Document], k: int = TOP_CHUNKS,
             max_chars: int = MAX_CONTEXT_CHARS, semantic: Optional[List[int]] = None) -> List[Dict]:
    """
    Fragmentos más relevantes para la consulta, etiquetados [D1], [D2]… por documento.
    `semantic`: ranking por embeddings (opcional) que se fusiona con BM25 (RRF).
    Si nada coincide (p.ej. "resume este archivo"), se usa el inicio de cada documento.
    """
    if not docs:
        return []
    flat = [(d_idx, c_idx, chunk) for d_idx, d in enumerate(docs) for c_idx, chunk in enumerate(d.chunks)]
    lexical = [i for i, _ in BM25([c for _, _, c in flat]).top(query, k * 3)]
    order = _fuse([lexical, semantic], k) if semantic else lexical[:k]
    picks = [flat[i] for i in order]
    if not picks:
        per_doc = max(1, k // len(docs))
        picks = [(d_idx, c_idx, d.chunks[c_idx]) for d_idx, d in enumerate(docs)
                 for c_idx in range(min(per_doc, len(d.chunks)))]
    picks.sort(key=lambda p: (p[0], p[1]))  # orden de lectura

    results, used = [], 0
    for d_idx, c_idx, chunk in picks:
        if used >= max_chars:
            break
        text = chunk[: max_chars - used]
        used += len(text)
        results.append({"label": f"D{d_idx + 1}", "document_id": docs[d_idx].id, "name": docs[d_idx].name,
                        "chunk": c_idx + 1, "content": text})
    return results
