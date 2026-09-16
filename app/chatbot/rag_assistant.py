"""
Compliance RAG Assistant
Answers inspector and packager questions on Legal Metrology Act & Packaged Commodities Rules 2011.
"""

from typing import Dict, Any, List
from ..knowledge.vector_store import ComplianceVectorStore


class RAGAssistant:
    def __init__(self, vector_store: ComplianceVectorStore):
        self.vector_store = vector_store
        self._seed_default_knowledge()

    def _seed_default_knowledge(self):
        faq_data = [
            {
                "title": "MRP Rule 6(1)(e)",
                "text": "Under Rule 6(1)(e) of Legal Metrology (Packaged Commodities) Rules 2011, the retail sale price shall clearly mention '(inclusive of all taxes)' and must be stated in Indian Rupees (₹ or Rs.).",
                "source": "Legal Metrology Rules 2011, Rule 6(1)(e)",
            },
            {
                "title": "Net Quantity Rule 6(1)(f)",
                "text": "Net quantity shall be declared in standard metric units: mass in grams (g) or kilograms (kg), volume in milliliters (ml) or liters (l), length in meters (m) or centimeters (cm). Non-metric units like lbs or oz are strictly prohibited.",
                "source": "Legal Metrology Rules 2011, Rule 6(1)(f)",
            },
            {
                "title": "Consumer Care Rule 6(1)(h)",
                "text": "Every package shall bear the name, address, telephone number, and email address of the designated officer or grievance redressal cell.",
                "source": "Legal Metrology Rules 2011, Rule 6(1)(h)",
            },
        ]
        self.vector_store.add_documents(faq_data)

    def answer_query(self, query: str) -> Dict[str, Any]:
        retrieved_docs: List[Dict[str, Any]] = self.vector_store.search(query, top_k=2)
        if not retrieved_docs:
            return {
                "answer": "No relevant Legal Metrology clause found in the local knowledge base.",
                "citations": [],
            }

        context = "\n".join(f"- {d.get('title')}: {d.get('text')}" for d in retrieved_docs)
        answer = f"According to statutory provisions:\n{context}"

        return {
            "answer": answer,
            "citations": [d.get("source") for d in retrieved_docs if d.get("source")],
        }
