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
        # Citations verified against the consolidated LMPC Rules 2011 text (as amended 2017/2021)
        # and the FSS (Labelling and Display) Regulations 2020.
        faq_data = [
            {
                "title": "MRP Rule 6(1)(e)",
                "text": "Under Rule 6(1)(e) of Legal Metrology (Packaged Commodities) Rules 2011, the retail sale price shall clearly mention '(inclusive of all taxes)' and must be stated in Indian Rupees (₹ or Rs.). Unit Sale Price is additionally mandatory per the 2021 amendment (G.S.R. 779(E)).",
                "source": "Legal Metrology Rules 2011, Rule 6(1)(e)",
            },
            {
                "title": "Net Quantity Rule 6(1)(c)",
                "text": "Net quantity shall be declared in standard metric units: mass in grams (g) or kilograms (kg), volume in milliliters (ml) or liters (l), length in meters (m) or centimeters (cm). Non-metric units like lbs or oz are strictly prohibited.",
                "source": "Legal Metrology Rules 2011, Rule 6(1)(c)",
            },
            {
                "title": "Consumer Care Rule 6(2)",
                "text": "Every package shall bear the name, address, telephone number, and email address of the designated officer or grievance redressal cell. This requirement was inserted as sub-rule 6(2) by the 2017 Amendment (G.S.R. 629(E)).",
                "source": "Legal Metrology Rules 2011, Rule 6(2)",
            },
            {
                "title": "Country of Origin Rule 6(1)(aa)",
                "text": "For imported packages, the name of the country of origin or manufacture or assembly must be declared conspicuously on the package (clause inserted by the 2017 Amendment).",
                "source": "Legal Metrology Rules 2011, Rule 6(1)(aa)",
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
