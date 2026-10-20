import asyncio
import io

import pytest

from app.agents.catalog import AGENTS
from app.services import web_search
from app.services.documents import DocumentError, build_document, extract_text, retrieve
from app.services.orchestrator import Orchestrator
from app.services.text_utils import BM25, chunk_text
from tests.conftest import FakeLLM

A, B = AGENTS["fullstack_developer"], AGENTS["seo_specialist"]


def run(coro):
    return asyncio.run(coro)


async def noop(_event):
    pass


# ------------------------------------------------------------------ texto

def test_chunking_respects_size_and_keeps_all_text():
    text = "\n\n".join(f"Párrafo {i} " + "palabra " * 60 for i in range(20))
    chunks = chunk_text(text, size=500, overlap=50)
    assert len(chunks) > 5 and all(len(c) <= 560 for c in chunks)
    assert "Párrafo 19" in chunks[-1]


def test_bm25_ranks_relevant_chunk_first():
    docs = ["receta de pan casero con harina", "contrato de alquiler y cláusulas de rescisión", "pan y vino"]
    assert BM25(docs).top("rescisión del contrato", 1)[0][0] == 1


# -------------------------------------------------------------- extracción

def test_extract_plain_html_json_and_reject_unknown():
    assert "hola" in extract_text("a.txt", "hola mundo".encode())
    assert "visible" in extract_text("a.html", b"<script>x()</script><p>visible</p>")
    assert '"k": 1' in extract_text("a.json", b'{"k":1}')
    with pytest.raises(DocumentError):
        extract_text("a.exe", b"MZ")


def test_extract_docx():
    import docx
    buf = io.BytesIO()
    d = docx.Document()
    d.add_paragraph("Política de devoluciones: 30 días")
    d.save(buf)
    assert "30 días" in extract_text("p.docx", buf.getvalue())


def test_pdf_without_text_is_reported():
    from pypdf import PdfWriter
    buf = io.BytesIO()
    w = PdfWriter()
    w.add_blank_page(width=200, height=200)
    w.write(buf)
    with pytest.raises(DocumentError, match="texto"):
        extract_text("scan.pdf", buf.getvalue())


def test_build_document_limits():
    with pytest.raises(DocumentError):
        build_document("vacio.txt", "text/plain", b"", None)
    doc = build_document("../../etc/notas.txt", "text/plain", ("dato " * 1000).encode(), None)
    assert doc.name == "notas.txt" and doc.chunks


def test_retrieve_labels_and_fallback_to_beginning():
    d1 = build_document("ventas.txt", "", "Las ventas de marzo subieron 20% en Chile.".encode(), None)
    d2 = build_document("rrhh.txt", "", "Política de vacaciones: 15 días hábiles.".encode(), None)
    hits = retrieve("¿cuántos días de vacaciones hay?", [d1, d2])
    assert hits[0]["label"] == "D2" and "15 días" in hits[0]["content"]
    generic = retrieve("resume esto", [d1, d2])
    assert {h["label"] for h in generic} == {"D1", "D2"}


# ------------------------------------------------------------ búsqueda web

def test_search_config_validation():
    assert web_search.validate_search_config({"provider": "tavily", "apiKey": "tvly-123"})["provider"] == "tavily"
    assert web_search.validate_search_config({"provider": "tavily", "apiKey": ""}) is None
    assert web_search.validate_search_config({"provider": "google"}) is None
    assert web_search.validate_search_config({"provider": "searxng", "baseUrl": "http://169.254.169.254"}) is None


def test_search_dedupes_and_numbers(monkeypatch):
    async def fake_one(client, cfg, query):
        return [{"title": f"{query} A", "url": "https://a.com", "content": "x"},
                {"title": "B", "url": "https://b.com", "content": "y"}, {"title": "bad", "url": "ftp://z"}]
    monkeypatch.setattr(web_search, "_search_one", fake_one)
    sources = run(web_search.search({"provider": "tavily", "api_key": "k", "base_url": ""}, ["q1", "q2"]))
    assert [s["label"] for s in sources] == ["W1", "W2"] and [s["url"] for s in sources] == ["https://a.com", "https://b.com"]


def test_plan_queries_falls_back_to_task():
    class BadLLM(FakeLLM):
        async def complete(self, *a, **k):
            return "no json"
    from app.services.llm_client import Usage
    assert run(web_search.plan_queries("precio del cobre hoy", BadLLM(), "es", [], Usage())) == ["precio del cobre hoy"]


# ------------------------------------------------------ orquestador + fuentes

def test_orchestrator_injects_documents_and_web_sources(monkeypatch):
    async def fake_search(cfg, queries):
        return [{"label": "W1", "title": "Noticia", "url": "https://n.com", "content": "dato web reciente"}]
    monkeypatch.setattr(web_search, "search", fake_search)

    events = []

    async def emit(e):
        events.append(e)

    doc = build_document("plan.txt", "", "El presupuesto anual es de 50 mil dólares.".encode(), None)
    llm = FakeLLM(replies={"Generas consultas": '{"queries": ["presupuesto marketing 2026"]}'})
    orch = Orchestrator([A, B], llm, emit, documents=[doc],
                        web_search_config={"provider": "tavily", "api_key": "k", "base_url": ""})
    summary = run(orch.run("¿Cuál es el presupuesto?"))

    types = [e["type"] for e in events]
    assert types.index("research_start") < types.index("context_ready") < types.index("agent_start")
    assert next(e for e in events if e["type"] == "research_queries")["queries"] == ["presupuesto marketing 2026"]
    agent_user_msg = next(c for c in llm.calls if A.system_prompt[:50] in c[0]["content"])[-1]["content"]
    assert "[D1] plan.txt" in agent_user_msg and "[W1] Noticia" in agent_user_msg
    synth_user_msg = llm.calls[-1][-1]["content"]
    assert "[W1] Noticia https://n.com" in synth_user_msg
    assert {s["label"] for s in summary["sources"]} == {"D1", "W1"}


def test_web_failure_becomes_warning_not_crash(monkeypatch):
    async def failing(cfg, queries):
        raise web_search.WebSearchError("API key de Tavily inválida")
    monkeypatch.setattr(web_search, "search", failing)
    events = []

    async def emit(e):
        events.append(e)
    run(Orchestrator([A], FakeLLM(), emit, web_search_config={"provider": "tavily", "api_key": "k",
                                                              "base_url": ""}).run("x"))
    assert any(e["type"] == "warning" and "Tavily" in e["message"] for e in events)
    assert any(e["type"] == "agent_response" for e in events)
