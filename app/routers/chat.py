"""
Legal Metrology Statutory RAG Chatbot Router
"""

from datetime import datetime, timezone, timedelta
from typing import List, Optional
from fastapi import APIRouter
from pydantic import BaseModel

from app.knowledge.vector_store import ComplianceVectorStore
from app.chatbot.rag_assistant import RAGAssistant
from app.services.chat_service import answer_compliance_question as keyword_fallback

router = APIRouter(prefix="/api/chat", tags=["Legal Metrology Chatbot"])

_vector_store = ComplianceVectorStore()
_rag_assistant = RAGAssistant(_vector_store)
IST = timezone(timedelta(hours=5, minutes=30))


class ChatRequest(BaseModel):
    message: str


class ChatResponse(BaseModel):
    reply: str
    text: Optional[str] = None
    citations: List[str] = []
    sources: List[str] = []
    timestamp: str


@router.post("", response_model=ChatResponse)
def chat_endpoint(req: ChatRequest):
    """
    RAG-powered conversational assistant for enforcement officers & packagers.
    Retrieves Legal Metrology (Packaged Commodities) statutory sections and citations.
    """
    query = req.message.strip()
    now_iso = datetime.now(IST).isoformat()

    try:
        res = _rag_assistant.answer_query(query)
        reply = res.get("answer", "")
        citations = res.get("citations", [])
    except Exception:
        # Fallback to keyword matcher if sentence-transformers not available
        reply, citations = keyword_fallback(query)

    # If RAG returned generic no-match, consult keyword service as backup
    if "No relevant" in reply:
        fallback_reply, fallback_citations = keyword_fallback(query)
        if fallback_reply and "I don't have" not in fallback_reply:
            reply = fallback_reply
            citations = fallback_citations or citations

    return ChatResponse(
        reply=reply,
        text=reply,
        citations=citations,
        sources=citations,
        timestamp=now_iso,
    )
