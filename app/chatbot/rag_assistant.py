"""
Compliance RAG Assistant
Answers inspector and packager questions on Legal Metrology Act & Packaged Commodities Rules 2011.
LLM synthesis provider order: Groq (GROQ_API_KEY, OpenAI-compatible endpoint) ->
Gemini (GEMINI_API_KEY, google-genai) -> non-LLM statutory template fallback.
"""

import logging
import os
from typing import Dict, Any, List, Optional

try:
    from app.knowledge.vector_store import ComplianceVectorStore
    from app.config import settings
except (ImportError, ValueError):
    from ..knowledge.vector_store import ComplianceVectorStore
    from ..config import settings

logger = logging.getLogger(__name__)


class RAGAssistant:
    def __init__(self, vector_store: ComplianceVectorStore):
        self.vector_store = vector_store
        self._seed_default_knowledge()
        self._client: Any = None
        self._init_gemini_client()

    def _init_gemini_client(self):
        """
        Initializes the official Google GenAI client if GEMINI_API_KEY is configured.
        SECURITY: Never logs, returns, or prints the API key value.
        """
        if not settings.is_gemini_configured:
            logger.info("GEMINI_API_KEY is not configured. Retaining non-LLM template fallback mode.")
            return

        try:
            from google import genai
            key = settings.GEMINI_API_KEY or os.environ.get("GEMINI_API_KEY")
            self._client = genai.Client(api_key=key)
            logger.info("Google GenAI client successfully initialized for RAG chatbot.")
        except Exception as e:
            logger.warning("Failed to initialize Google GenAI client (%s). Retaining non-LLM fallback.", type(e).__name__)
            self._client = None

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

    def _format_scan_context(self, sc: Dict[str, Any]) -> str:
        lines = ["ACTIVE INSPECTION REPORT UNDER AUDIT:"]
        scan_id = sc.get("id") or sc.get("scan_id") or sc.get("scanId") or ""
        p_name = sc.get("product_name") or sc.get("productName") or "Unknown Product"
        brand = sc.get("brand") or "Unknown Brand"
        net_wt = sc.get("net_weight") or sc.get("netWeight") or "N/A"
        status = sc.get("status") or "N/A"
        score = sc.get("compliance_score") or sc.get("complianceConfidence") or "N/A"

        if scan_id:
            lines.append(f"- Inspection ID: {scan_id}")
        lines.append(f"- Product: {p_name}")
        lines.append(f"- Brand: {brand}")
        lines.append(f"- Declared Net Quantity: {net_wt}")
        lines.append(f"- Overall Compliance Status: {str(status).upper()} ({score}% Confidence)")

        images = sc.get("imageUris") or ([sc.get("imageUri")] if sc.get("imageUri") else [])
        if images:
            lines.append(f"- Captured Image Views ({len(images)}): {', '.join(str(img) for img in images)}")

        fields = sc.get("fields") or []
        if isinstance(fields, list) and fields:
            lines.append("- Statutory Declarations Audited:")
            for f in fields:
                if isinstance(f, dict):
                    f_name = f.get("label") or f.get("fieldName") or "Field"
                    f_st = str(f.get("status", "unknown")).upper()
                    f_val = f.get("extractedValue") or f.get("extractedText") or f.get("value") or "N/A"
                    f_viol = f.get("violationReason") or ""
                    f_rule = f.get("ruleRef") or f.get("ruleCitation") or ""
                    viol_note = f" (Issue: {f_viol})" if f_viol else ""
                    rule_note = f" [{f_rule}]" if f_rule else ""
                    lines.append(f"  * {f_name}: {f_st} | Value: '{f_val}'{rule_note}{viol_note}")
        elif isinstance(fields, dict) and fields:
            lines.append("- Statutory Declarations Audited:")
            for k, v in fields.items():
                if isinstance(v, dict):
                    f_name = v.get("label", k)
                    f_st = "PASS" if v.get("found") and v.get("is_valid", True) else ("WARNING" if v.get("location") == "SEE_FLAP" else "FAIL")
                    f_val = v.get("value") or v.get("captured") or "N/A"
                    lines.append(f"  * {f_name}: {f_st} | Value: '{f_val}'")
        return "\n".join(lines)

    def answer_query(self, query: str, scan_context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Answers a user query using vector search over statutory provisions,
        enriched with Gemini LLM generation if GEMINI_API_KEY is configured,
        or statutory template fallback if unconfigured or unavailable.
        Optionally incorporates active scan inspection context & captured images.
        """
        retrieved_docs: List[Dict[str, Any]] = self.vector_store.search(query, top_k=3)
        citations = [d.get("source") for d in (retrieved_docs or []) if d.get("source")]
        context = "\n".join(f"- {d.get('title')}: {d.get('text')}" for d in (retrieved_docs or []))

        scan_summary = self._format_scan_context(scan_context) if scan_context else ""

        if not retrieved_docs and not scan_context:
            return {
                "answer": "No relevant Legal Metrology clause found in the local knowledge base.",
                "citations": [],
                "llm_generated": False,
            }

        template_parts = []
        if scan_summary:
            template_parts.append(scan_summary)
        if context:
            template_parts.append(f"According to statutory provisions:\n{context}")
        template_answer = "\n\n".join(template_parts)

        # Provider-agnostic synthesis: Groq (primary) -> Gemini (secondary) -> statutory template.
        if settings.is_groq_configured:
            synthesized = self._synthesize_groq(query, context, scan_context=scan_context)
            if synthesized:
                return {
                    "answer": synthesized,
                    "citations": citations,
                    "llm_generated": True,
                }
        elif not settings.is_gemini_configured:
            logger.info("No GROQ_API_KEY/GEMINI_API_KEY configured; retaining non-LLM statutory template.")

        # Lazy initialize Gemini client if configured but not yet created
        if settings.is_gemini_configured and self._client is None:
            self._init_gemini_client()

        if self._client is not None:
            try:
                prompt = self._build_prompt(query, context, scan_context=scan_context)
                config = None
                try:
                    from google.genai import types
                    config = types.GenerateContentConfig(
                        temperature=0.2,
                        max_output_tokens=2048,
                    )
                except Exception:
                    pass
                response = self._client.models.generate_content(
                    model=settings.GEMINI_MODEL,
                    contents=prompt,
                    config=config,
                )
                if response and hasattr(response, "text") and response.text:
                    return {
                        "answer": response.text.strip(),
                        "citations": citations,
                        "llm_generated": True,
                    }
            except Exception as e:
                logger.warning(
                    "Gemini LLM generation failed (%s). Retaining non-LLM statutory template fallback.",
                    type(e).__name__
                )

        # Fallback to local template
        return {
            "answer": template_answer,
            "citations": citations,
            "llm_generated": False,
        }

    def _build_prompt(self, query: str, context: str, scan_context: Optional[Dict[str, Any]] = None) -> str:
        scan_sec = ""
        if scan_context:
            scan_sec = f"\n{self._format_scan_context(scan_context)}\n"

        return (
            "You are an expert Legal Metrology Compliance Officer assistant for PRAMAN v4.\n"
            f"{scan_sec}"
            f"User Question: \"{query}\"\n\n"
            f"Statutory Context & Gazette Provisions:\n{context}\n\n"
            "MANDATORY INSTRUCTIONS:\n"
            "1. LANGUAGE: Respond EXCLUSIVELY in clear, professional English. NEVER output Hindi/Devanagari text (e.g. do NOT output 'ग्रुप पैकेज', '(ट, ख)', or Hindi gazette quotes), even if the retrieved gazette context contains Hindi. Always use official English statutory terms and official English gazette text.\n"
            "2. FORMATTING & NEATNESS:\n"
            "   - Format the response cleanly and elegantly with clear section headings, structured bullet points, and highlighted key terms.\n"
            "   - If classifying packaging types or presenting structured comparisons, use clean structured definition blocks or well-aligned markdown tables.\n"
            "   - For each classification category, clearly state:\n"
            "     * Pack Classification Name\n"
            "     * Defining Criteria & Characteristics\n"
            "     * Relevant Statutory Provision (Rule & Gazette citation in English)\n"
            "     * Official Gazette Illustrations / Practical Examples\n"
            "3. STATUTORY ACCURACY:\n"
            "   - Under the Legal Metrology (Packaged Commodities) Rules, 2011 (including G.S.R. 722(E) dated 6 Oct 2023):\n"
            "     * 'Combination package' (Rule 2(ka)): Contains two or more individual pieces or packages of DISSIMILAR commodities (e.g., spoon, knife, fork, cup, napkins).\n"
            "     * 'Group package' (Rule 2(kb)): Contains two or more individual pieces or packages of SIMILAR, but NOT identical commodities differing in size, quantity, appearance, or brand (e.g., sponges of different dimensions, assorted biscuits).\n"
            "     * 'Multi-piece package' (Rule 2(kc)): Contains two or more individual packaged or labelled pieces of the SAME commodities of IDENTICAL quantity (e.g., 5 soap cakes of 20g each = 100g total). For food articles, FSSA 2006 provisions additionally apply.\n"
            "     * Unit Sale Price exemption (Rule 6(11) proviso): Declaration of Unit Sale Price is NOT required for combination, group, or multi-piece packages.\n"
            "   - Cite verified rule numbers and gazette citations in English.\n"
            "4. COMPLETION: Ensure all explanations, table cells, and sentences are fully completed without truncating mid-sentence.\n"
            "5. If active inspection data is provided above, refer directly to this specific product, its declarations, detected issues (e.g. flap pointers, missing details), and captured images."
        )

    def _synthesize_groq(self, query: str, context: str, scan_context: Optional[Dict[str, Any]] = None) -> Optional[str]:
        """
        Synthesizes an answer with Groq's OpenAI-compatible chat completions API.
        SECURITY: Sends the key only in the Authorization header; never logs it.
        Returns None on any failure so callers can fall back honestly.
        """
        try:
            import httpx
        except ImportError:
            logger.warning("httpx is not installed; Groq synthesis unavailable. Run: pip install httpx")
            return None

        key = settings.GROQ_API_KEY or os.environ.get("GROQ_API_KEY")
        if not key:
            return None

        try:
            resp = httpx.post(
                f"{settings.GROQ_API_BASE.rstrip('/')}/chat/completions",
                headers={
                    "Authorization": f"Bearer {key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": settings.GROQ_MODEL,
                    "messages": [
                        {
                            "role": "system",
                            "content": (
                                "You are an expert Legal Metrology Compliance Officer assistant for PRAMAN. "
                                "Answer strictly from the supplied statutory context and active inspection data in fluent, professional English. "
                                "Never output Hindi, Devanagari script, or Hindi gazette quotes. Structure your response neatly with clear headers, "
                                "well-defined bulleted points, and accurate English statutory citations."
                            ),
                        },
                        {
                            "role": "user",
                            "content": self._build_prompt(query, context, scan_context=scan_context),
                        },
                    ],
                    "temperature": 0.2,
                    "max_tokens": 2048,
                },
                timeout=settings.LLM_TIMEOUT_SECONDS,
            )
            resp.raise_for_status()
            data = resp.json()
            message = data.get("choices", [{}])[0].get("message", {})
            content = message.get("content") or message.get("text") or ""
            if content and content.strip():
                return content.strip()
            logger.warning("Groq returned an empty completion (%s).", settings.GROQ_MODEL)
        except Exception as e:
            logger.warning(
                "Groq LLM generation failed (%s). Falling back to next provider/template.",
                type(e).__name__
            )
        return None
