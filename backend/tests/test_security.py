from datetime import timedelta

import pytest
from fastapi import HTTPException

from app.auth import jwt_manager, user_from_token
from app.pg_database import PgDatabase
from app.validators import SecurityValidator, is_safe_outbound_url


@pytest.mark.parametrize("url", [
    "http://127.0.0.1:5432", "http://localhost:11434/v1", "http://169.254.169.254/latest/meta-data",
    "http://10.0.0.5/v1", "http://192.168.1.1", "http://[::1]/", "file:///etc/passwd",
    "gopher://example.com", "http://user:pass@example.com", "",
])
def test_ssrf_guard_blocks_private_and_odd_urls(url):
    assert not is_safe_outbound_url(url, allow_private=False)


def test_ssrf_guard_allows_private_when_enabled():
    assert is_safe_outbound_url("http://localhost:11434/v1", allow_private=True)


def test_api_config_normalizes_and_requires_key():
    cfg = SecurityValidator.validate_api_config({"type": "groq", "apiKey": "gsk_" + "x" * 40})
    assert cfg == {"type": "groq", "api_key": "gsk_" + "x" * 40, "base_url": "https://api.groq.com/openai/v1"}
    assert SecurityValidator.validate_api_config({"type": "openai", "apiKey": ""}) == {}
    assert SecurityValidator.validate_api_config({"type": "openai", "apiKey": "a b"}) == {}


def test_api_config_rejects_internal_base_url():
    cfg = {"type": "custom", "apiKey": "k" * 30, "baseUrl": "http://nexo-postgres:5432"}
    assert SecurityValidator.validate_api_config(cfg) == {}


def test_sanitize_text_keeps_code_symbols():
    text = "if a < b && c > d:\x00 print('<ok>')"
    assert SecurityValidator.sanitize_text(text) == "if a < b && c > d: print('<ok>')"


def test_jwt_roundtrip_and_type_check():
    token = jwt_manager.create_access_token({"user_id": "u1", "role": "free"})
    assert jwt_manager.verify_token(token)["user_id"] == "u1"
    assert user_from_token("Bearer " + token)["user_id"] == "u1"
    assert user_from_token("garbage") is None


def test_jwt_expired_is_rejected():
    token = jwt_manager.create_access_token({"user_id": "u1"}, expires_delta=timedelta(seconds=-1))
    with pytest.raises(HTTPException):
        jwt_manager.verify_token(token)


def test_password_hash_and_legacy_compat():
    h = PgDatabase._hash_password("s3cret-pass")
    assert h.startswith("pbkdf2$600000$")
    assert PgDatabase._verify_password("s3cret-pass", h)
    assert not PgDatabase._verify_password("wrong", h)
    import hashlib
    legacy = "abcd$" + hashlib.pbkdf2_hmac("sha256", b"old", b"abcd", 100000).hex()
    assert PgDatabase._verify_password("old", legacy)


def test_model_name_falls_back_to_real_default():
    from app.config import DEFAULT_MODEL
    assert SecurityValidator.validate_model_name("") == DEFAULT_MODEL
    assert SecurityValidator.validate_model_name("bad model; rm") == DEFAULT_MODEL
    assert SecurityValidator.validate_model_name("openai/gpt-oss-120b") == "openai/gpt-oss-120b"
