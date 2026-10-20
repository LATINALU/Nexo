import pytest
from fastapi.testclient import TestClient

import app.main as main
from tests.conftest import FakeLLM

API_CONFIG = {"type": "groq", "apiKey": "gsk_" + "x" * 40}


@pytest.fixture(scope="module")
def client():
    mp = pytest.MonkeyPatch()
    mp.setattr(main, "LLMClient", lambda cfg, model: FakeLLM())
    with TestClient(main.app) as c:  # sin DB ni Redis: el lifespan degrada a memoria
        yield c
    mp.undo()


def test_catalog_endpoints(client):
    assert client.get("/api/health").json()["agents_count"] == 500
    cats = client.get("/api/categories").json()
    assert cats["total"] == 50
    names = [c["name"].lower() for c in cats["categories"]]
    assert names == sorted(names)
    one = client.get("/api/agents", params={"category": "legal"}).json()
    assert one["total"] == 10 and all(a["category"] == "legal" for a in one["agents"])
    assert client.get("/api/agents/no_existe").status_code == 404


def test_removed_insecure_endpoints_are_gone(client):
    assert client.get("/api/chat/conversations", params={"client_id": "x"}).status_code == 404
    assert client.post("/api/chat", json={}).status_code in (404, 405)


def test_protected_endpoints_require_auth(client):
    for path in ("/api/history/", "/api/memory/", "/api/auth/me", "/api/ws-stats", "/api/admin/stats/system"):
        assert client.get(path).status_code == 401, path


def test_fetch_models_blocks_ssrf(client):
    r = client.post("/api/fetch-models", json={"api_type": "custom", "api_key": "k",
                                              "base_url": "http://169.254.169.254/latest"})
    assert r.json() == {"success": False, "models": [], "error": "URL base no permitida"}


def test_websocket_full_run_with_synthesis(client):
    with client.websocket_connect("/ws/test-client") as ws:
        assert ws.receive_json()["type"] == "connected"
        ws.send_json({"action": "start_pipeline", "message": "Crear landing page", "apiConfig": API_CONFIG,
                      "agents": ["fullstack_developer", "seo_specialist"], "model": "llama-3.3-70b-versatile"})
        events = []
        while True:
            event = ws.receive_json()
            events.append(event)
            if event["type"] in ("pipeline_complete", "error"):
                break
    types = [e["type"] for e in events]
    assert "error" not in types
    assert types.count("agent_response") == 2 and "synthesis_complete" in types
    assert "agent_token" in types and "synthesis_token" in types


def test_websocket_rejects_missing_api_key_and_foreign_origin(client):
    with client.websocket_connect("/ws/c") as ws:
        ws.receive_json()
        ws.send_json({"action": "start_pipeline", "message": "hola", "agents": ["fullstack_developer"]})
        event = ws.receive_json()
        assert event["type"] == "error" and "API key" in event["message"]

    from starlette.websockets import WebSocketDisconnect
    with pytest.raises(WebSocketDisconnect):
        with client.websocket_connect("/ws/c", headers={"origin": "https://evil.example"}) as ws:
            ws.receive_json()


def test_sse_stream(client):
    with client.stream("POST", "/api/chat-stream", json={
            "message": "Plan de marketing", "agents": ["seo_specialist"], "apiConfig": API_CONFIG}) as r:
        body = "".join(r.iter_text())
    assert '"type": "agent_response"' in body and '"type": "stream_complete"' in body


def test_suggest_agents_without_llm(client):
    r = client.post("/api/agents/suggest", json={"message": "auditoría de seguridad y pentesting web"})
    agents = r.json()["agents"]
    assert agents and all("id" in a and "name" in a for a in agents)


def test_agent_detail_includes_backstory_but_not_prompt(client):
    data = client.get("/api/agents/fullstack_developer").json()
    assert data["backstory"] and data["category_name"]
    assert "system_prompt" not in data
