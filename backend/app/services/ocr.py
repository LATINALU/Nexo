"""
Nexo - OCR de PDFs escaneados e imágenes
========================================
Motores, en orden de preferencia:
  1. Modelo con visión del propio usuario (BYOK, API compatible con OpenAI):
     gpt-4o-mini, claude-*, gemini-*, meta-llama/llama-4-* en Groq, llava en Ollama…
  2. Tesseract local, si está instalado (pytesseract + binario `tesseract`).
"""

from __future__ import annotations

import asyncio
import base64
import io
import logging
from typing import List, Optional

from app.services.llm_client import LLMClient, LLMError, Usage

logger = logging.getLogger("nexo.ocr")

MAX_OCR_PAGES = 30
MAX_IMAGE_SIDE = 1600
OCR_CONCURRENCY = 3
IMAGE_EXTENSIONS = (".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".tif", ".tiff")

_PROMPT = {
    "es": ("Transcribe TODO el texto de esta imagen de documento, en su idioma original y en orden de lectura. "
           "Conserva títulos, listas y tablas en markdown. No agregues comentarios ni descripciones. "
           "Si no hay texto, responde exactamente: [sin texto]"),
    "en": ("Transcribe ALL text in this document image, in its original language and reading order. "
           "Keep headings, lists and tables as markdown. Add no commentary. "
           "If there is no text, answer exactly: [no text]"),
}


class OCRError(ValueError):
    """Error presentable al usuario."""


def _normalize_image(data: bytes) -> bytes:
    """Convierte a JPEG RGB y limita el tamaño (menos tokens, mismo texto legible)."""
    try:
        from PIL import Image
    except ImportError:
        raise OCRError("Soporte de imágenes no instalado (Pillow)")
    try:
        img = Image.open(io.BytesIO(data))
        img.load()
    except Exception:
        raise OCRError("Imagen ilegible o en un formato no soportado")
    if img.mode not in ("RGB", "L"):
        img = img.convert("RGB")
    img.thumbnail((MAX_IMAGE_SIDE, MAX_IMAGE_SIDE))
    out = io.BytesIO()
    img.save(out, format="JPEG", quality=85)
    return out.getvalue()


def pdf_page_images(pdf_bytes: bytes, max_pages: int = MAX_OCR_PAGES) -> List[bytes]:
    """Imagen principal (la más grande) de cada página de un PDF escaneado."""
    from pypdf import PdfReader

    reader = PdfReader(io.BytesIO(pdf_bytes))
    pages: List[bytes] = []
    for page in list(reader.pages)[:max_pages]:
        best = None
        try:
            for image in page.images:
                if best is None or len(image.data) > len(best):
                    best = image.data
        except Exception as e:  # filtros de imagen exóticos
            logger.info("No se pudo extraer imagen de página: %s", e)
        if best:
            pages.append(_normalize_image(best))
    return pages


async def _ocr_with_llm(image: bytes, llm: LLMClient, language: str, usage: Usage) -> str:
    data_uri = "data:image/jpeg;base64," + base64.b64encode(image).decode()
    messages = [{"role": "user", "content": [
        {"type": "text", "text": _PROMPT.get(language, _PROMPT["es"])},
        {"type": "image_url", "image_url": {"url": data_uri}},
    ]}]
    text = (await llm.complete(messages, max_tokens=3000, temperature=0.0, usage=usage)).strip()
    return "" if text in ("[sin texto]", "[no text]") else text


def _ocr_with_tesseract(image: bytes) -> str:
    import pytesseract
    from PIL import Image
    return pytesseract.image_to_string(Image.open(io.BytesIO(image)), lang="spa+eng")


def tesseract_available() -> bool:
    try:
        import pytesseract
        pytesseract.get_tesseract_version()
        return True
    except Exception:
        return False


async def ocr_images(images: List[bytes], llm: Optional[LLMClient], language: str = "es") -> List[str]:
    """Texto de cada imagen. Usa el modelo de visión si hay; si no, Tesseract."""
    if not images:
        raise OCRError("No se encontraron imágenes para leer")
    if llm is None:
        if not tesseract_available():
            raise OCRError("Para leer documentos escaneados configura un modelo con visión en "
                           "Ajustes → Documentos (o instala Tesseract en el servidor)")
        return await asyncio.gather(*(asyncio.to_thread(_ocr_with_tesseract, img) for img in images))

    semaphore = asyncio.Semaphore(OCR_CONCURRENCY)
    usage = Usage()

    async def one(img: bytes) -> str:
        async with semaphore:
            return await _ocr_with_llm(img, llm, language, usage)

    try:
        texts = await asyncio.gather(*(one(img) for img in images))
    except LLMError as e:
        raise OCRError(f"El modelo de visión falló: {e}. ¿El modelo elegido acepta imágenes?")
    logger.info("OCR de %d página(s): %d tokens", len(images), usage.total_tokens)
    return list(texts)
