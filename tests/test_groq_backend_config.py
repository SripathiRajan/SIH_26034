"""
Unit & Integration Tests for Groq API Configuration, Detection, Security & Fallback
Verifies:
1. GROQ_API_KEY is read securely from the environment/.env.
2. Application can detect whether GROQ_API_KEY is configured (is_groq_configured).
3. API key is NEVER exposed in logs, responses, or status endpoints.
4. When Groq synthesis fails, application falls back cleanly to statutory templates.
5. Groq synthesis success path returns llm_generated=True with the synthesized answer.
"""

import os
from unittest.mock import patch, PropertyMock, MagicMock
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.config import Settings, settings
from app.knowledge.vector_store import ComplianceVectorStore
from app.chatbot.rag_assistant import RAGAssistant


@pytest.fixture(scope="module")
def client():
    return TestClient(app)


def test_groq_api_key_detection_when_configured():
    """Verify is_groq_configured returns True when GROQ_API_KEY is set."""
    custom_settings = Settings(GROQ_API_KEY="test-configured-dummy-key")
    assert custom_settings.is_groq_configured is True
    assert isinstance(custom_settings.is_groq_configured, bool)


def test_groq_api_key_detection_when_missing():
    """Verify is_groq_configured returns False when GROQ_API_KEY is unset or empty string."""
    with patch.dict(os.environ, {}, clear=True):
        empty_settings = Settings(GROQ_API_KEY="")
        assert empty_settings.is_groq_configured is False

        unset_settings = Settings(GROQ_API_KEY=None)
        # GROQ_API_KEY=None makes the property fall back to os.environ (cleared here)
        assert unset_settings.is_groq_configured is False


def test_llm_provider_property_prefers_groq():
    """Groq is the primary provider: llm_provider reports 'groq' when its key is set."""
    custom_settings = Settings(GROQ_API_KEY="test-dummy", GEMINI_API_KEY=None)
    assert custom_settings.llm_provider == "groq"

    gemini_only = Settings(GROQ_API_KEY=None, GEMINI_API_KEY="test-dummy")
    assert gemini_only.llm_provider == "gemini"

    neither = Settings(GROQ_API_KEY=None, GEMINI_API_KEY=None)
    assert neither.llm_provider is None


def test_no_groq_key_leaked_in_status_endpoint(client):
    """GET /api/chat/status returns groq_configured boolean and never leaks the key."""
    resp = client.get("/api/chat/status")
    assert resp.status_code == 200
    data = resp.json()
    assert "groq_configured" in data
    assert isinstance(data["groq_configured"], bool)
    assert "llm_provider" in data

    # Strictly ensure no secret key field or value exists in response
    assert "api_key" not in data
    assert "GROQ_API_KEY" not in data
    assert "key" not in data


def test_chat_response_never_leaks_groq_key(client):
    """POST /api/chat returns statutory answer without leaking the Groq API key."""
    resp = client.post(
        "/api/chat",
        json={"message": "What is the requirement for Maximum Retail Price under Rule 6(1)(e)?"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "reply" in data
    assert "citations" in data
    assert "groq_configured" in data
    assert isinstance(data["groq_configured"], bool)

    resp_text = resp.text
    env_key = os.environ.get("GROQ_API_KEY")
    if env_key:
        assert env_key not in resp_text


def test_rag_assistant_falls_back_when_groq_synthesis_fails():
    """When Groq is configured but synthesis raises, fall back to statutory template honestly."""
    vs = ComplianceVectorStore()

    with patch.object(Settings, "is_groq_configured", new_callable=PropertyMock) as mock_cfg, \
         patch.object(settings, "GROQ_API_KEY", "test-dummy-key"), \
         patch("httpx.post", side_effect=ConnectionError("network down")):
        mock_cfg.return_value = True
        assistant = RAGAssistant(vs)
        result = assistant.answer_query("What are the rules for net quantity?")

        assert "answer" in result
        assert "According to statutory provisions:" in result["answer"]
        assert result.get("llm_generated") is False
        assert len(result.get("citations", [])) > 0


def test_rag_assistant_groq_success_path():
    """When Groq synthesis succeeds, answer is LLM-generated with citations preserved."""
    vs = ComplianceVectorStore()

    fake_resp = MagicMock()
    fake_resp.raise_for_status.return_value = None
    fake_resp.json.return_value = {
        "choices": [{"message": {"content": "Groq-synthesized statutory answer."}}]
    }

    with patch.object(Settings, "is_groq_configured", new_callable=PropertyMock) as mock_cfg, \
         patch.object(settings, "GROQ_API_KEY", "test-dummy-key"), \
         patch("httpx.post", return_value=fake_resp) as mock_post:
        mock_cfg.return_value = True
        assistant = RAGAssistant(vs)
        result = assistant.answer_query("What are the MRP declaration rules?")

        assert result["answer"] == "Groq-synthesized statutory answer."
        assert result["llm_generated"] is True
        assert len(result.get("citations", [])) > 0

        # Authorization header carries the key; it must never appear in logged bodies
        headers = mock_post.call_args.kwargs["headers"]
        assert headers["Authorization"].startswith("Bearer ")


def test_groq_request_uses_configured_model_and_base():
    """Groq call targets the configured base URL and model name."""
    vs = ComplianceVectorStore()

    fake_resp = MagicMock()
    fake_resp.raise_for_status.return_value = None
    fake_resp.json.return_value = {"choices": [{"message": {"content": "ok"}}]}

    with patch.object(Settings, "is_groq_configured", new_callable=PropertyMock) as mock_cfg, \
         patch.object(settings, "GROQ_API_KEY", "test-dummy-key"), \
         patch.object(settings, "GROQ_MODEL", "llama-3.1-8b-instant"), \
         patch.object(settings, "GROQ_API_BASE", "https://api.groq.com/openai/v1"), \
         patch("httpx.post", return_value=fake_resp) as mock_post:
        mock_cfg.return_value = True
        assistant = RAGAssistant(vs)
        assistant.answer_query("net quantity units?")

        url = mock_post.call_args.args[0]
        payload = mock_post.call_args.kwargs["json"]
        assert url == "https://api.groq.com/openai/v1/chat/completions"
        assert payload["model"] == "llama-3.1-8b-instant"
