import asyncio

import pytest

from app.agents.catalog import AGENTS
from app.services import web_search
from app.services.documents import Embedder, build_document, retrieve, semantic_ranking
from app.services.llm_client import LLMError, ToolsUnsupported
from app.services.orchestrator import MAX_TOOL_ROUNDS, Orchestrator
from tests.conftest import FakeLLM

A, B = AGENTS["fullstack_developer"], AGENTS["seo_specialist"]

# "Embeddings" de juguete: cada concepto es una dimensión; sinónimos comparten dimensión
CONCEPTS = [("vacaciones", "libres", "descanso", "feriado"), ("ventas", "facturación", "ingresos"), ("perro", "mascota")]


def toy_vector(text: str):
    t = text.lower()
    return [float(sum(t.count(w) for w in group)) + 0.01 for group in CONCEPTS]


class EmbedLLM(FakeLLM):
    def __init__(self, fail=False):
        super().__init__()
        self.embedded = 0
        self.fail = fail

    async def embed(self, texts, model):
        if self.fail:
            raise LLMError("Modelo de embeddings no encontrado")
        self.embedded += len(texts)
        return [toy_vector(t) for t in texts]


def run(coro):
    return asyncio.run(coro)


def doc(name, text):
    return run(build_document(name, "", text.encode(), None))


class Recorder:
    def __init__(self):
        self.events = []

    async def __call__(self, e):
        self.events.append(e)

    def of(self, kind):
        return [e for e in self.events if e["type"] == kind]


# ------------------------------------------------------------- semántica

def test_semantic_finds_synonyms_that_bm25_misses():
    d1 = doc("ventas.txt", "Los ingresos del trimestre crecieron un 20%.")
    d2 = doc("rrhh.txt", "Cada empleado tiene 15 días de vacaciones por año.")
    query = "descanso anual del personal"  # ninguna palabra en común con rrhh.txt
    lexical_only = retrieve(query, [d1, d2], k=1)
    assert lexical_only[0]["name"] == "ventas.txt"  # BM25 no encuentra nada: cae al inicio del primer doc

    embedder = Embedder(EmbedLLM(), "toy-embed")
    ranking = run(semantic_ranking(query, [d1, d2], embedder, 2))
    hits = retrieve(query, [d1, d2], k=1, semantic=ranking)
    assert hits[0]["name"] == "rrhh.txt"


def test_chunk_vectors_are_cached_per_model():
    d = doc("a.txt", "mascota perro " * 20)
    llm = EmbedLLM()
    embedder = Embedder(llm, "toy-embed")
    run(semantic_ranking("perro", [d], embedder, 1))
    first = llm.embedded
    run(semantic_ranking("mascota", [d], embedder, 1))
    assert llm.embedded == first + 1  # solo se embebió la nueva consulta


def test_embedding_failure_falls_back_to_bm25_with_warning():
    rec = Recorder()
    d = doc("rrhh.txt", "Política de vacaciones: 15 días.")
    orch = Orchestrator([A], FakeLLM(), rec, documents=[d], embedder=Embedder(EmbedLLM(fail=True), "x"))
    run(orch.run("vacaciones"))
    assert any("semántica" in e["message"] for e in rec.of("warning"))
    assert rec.of("context_ready")[0]["sources"][0]["title"] == "rrhh.txt"


def test_sequential_mode_keeps_document_context_for_every_agent():
    llm = FakeLLM()
    d = doc("plan.txt", "El presupuesto es de 50 mil dólares.")
    run(Orchestrator([A, B], llm, Recorder(), mode="sequential", synthesize=False, documents=[d]).run("presupuesto"))
    second_user = llm.calls[1][-1]["content"]
    assert "[D1] plan.txt" in second_user and "Aportes previos" in second_user


# -------------------------------------------------------- herramientas

class ToolLLM(FakeLLM):
    """Primera ronda: pide buscar_web; segunda: responde citando."""

    def __init__(self, always_call=False):
        super().__init__()
        self.always_call = always_call
        self.tool_rounds = []

    async def stream_events(self, messages, tools=None, max_tokens=2048, temperature=0.7, usage=None):
        self.calls.append(messages)
        self.tool_rounds.append(tools is not None)
        already_used = any(m.get("role") == "tool" for m in messages)
        if tools and (self.always_call or not already_used):
            yield ("text", "Voy a investigar. ")
            yield ("tool_calls", [{"id": f"c{len(self.calls)}", "name": "buscar_web",
                                   "arguments": {"consulta": "precio cobre 2026"}}])
            return
        tool_text = next((m["content"] for m in messages if m.get("role") == "tool"), "")
        yield ("text", f"Según la fuente: {tool_text[:60]}")


@pytest.fixture
def fake_web(monkeypatch):
    queries = []

    async def search(cfg, qs):
        queries.extend(qs)
        return [{"label": "W1", "title": "Cobre hoy", "url": "https://metales.example/cobre", "content": "9.800 USD/t"}]
    monkeypatch.setattr(web_search, "search", search)
    return queries


WEB = {"provider": "tavily", "api_key": "k", "base_url": ""}


def test_native_tools_agents_search_on_demand_and_share_labels(fake_web):
    rec, llm = Recorder(), ToolLLM()
    orch = Orchestrator([A, B], llm, rec, web_search_config=WEB, tool_mode="native", synthesize=False)
    summary = run(orch.run("¿A cuánto está el cobre?"))

    assert not rec.of("research_start")  # sin búsqueda previa: deciden los agentes
    calls = rec.of("tool_call")
    assert {c["agent_id"] for c in calls} == {A.id, B.id} and calls[0]["query"] == "precio cobre 2026"
    assert [s["label"] for s in summary["sources"]] == ["W1"]  # misma URL -> misma etiqueta
    contents = [e["data"]["raw_content"] for e in rec.of("agent_response")]
    assert all("[W1] Cobre hoy" in c and c.startswith("Voy a investigar.") for c in contents)
    convo = llm.calls[1]
    assert convo[-2]["tool_calls"][0]["function"]["name"] == "buscar_web" and convo[-1]["role"] == "tool"


def test_native_tool_rounds_are_capped(fake_web):
    llm = ToolLLM(always_call=True)
    run(Orchestrator([A], llm, Recorder(), web_search_config=WEB, tool_mode="native").run("x"))
    assert llm.tool_rounds == [True] * MAX_TOOL_ROUNDS + [False]


def test_native_documents_tool(monkeypatch):
    class DocToolLLM(ToolLLM):
        async def stream_events(self, messages, tools=None, **kw):
            self.calls.append(messages)
            if tools and not any(m.get("role") == "tool" for m in messages):
                names = [t["function"]["name"] for t in tools]
                assert names == ["buscar_documentos"]
                yield ("tool_calls", [{"id": "d1", "name": "buscar_documentos", "arguments": {"consulta": "vacaciones"}}])
                return
            yield ("text", "Ok [D1]")
    rec = Recorder()
    d = doc("rrhh.txt", "Política de vacaciones: 15 días hábiles.")
    summary = run(Orchestrator([A], DocToolLLM(), rec, documents=[d], tool_mode="native").run("¿vacaciones?"))
    assert summary["sources"][0]["label"] == "D1" and rec.of("tool_call")[0]["tool"] == "buscar_documentos"


def test_models_without_tools_fall_back_to_prefetch_once(fake_web):
    class NoTools(FakeLLM):
        async def stream_events(self, *a, **k):
            raise ToolsUnsupported("no tools")
            yield  # pragma: no cover

    rec = Recorder()
    run(Orchestrator([A, B], NoTools(replies={"Generas consultas": '{"queries": ["cobre"]}'}), rec,
                     web_search_config=WEB, tool_mode="native").run("cobre"))
    assert len([w for w in rec.of("warning") if "herramientas" in w["message"]]) == 1
    assert len(rec.of("research_start")) == 1 and fake_web == ["cobre"]
    assert len(rec.of("agent_response")) == 2


def test_native_mode_without_sources_behaves_like_normal():
    rec = Recorder()
    orch = Orchestrator([A], ToolLLM(), rec, tool_mode="native")
    assert orch.native_tools is False
    run(orch.run("hola"))
    assert rec.of("agent_response")
