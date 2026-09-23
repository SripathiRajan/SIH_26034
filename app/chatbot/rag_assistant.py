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
        # Citations verified against the consolidated LMPC Rules 2011 text (as amended 2017/2021/2023)
        # and the FSS (Labelling and Display) Regulations 2020.
        faq_data = [
            {
                "title": "Mandatory Declarations Overview",
                "text": "Every pre-packaged commodity in India must declare: 1) Name and address of the manufacturer/packer/importer, 2) Country of origin for imported goods, 3) Common or generic name of the commodity, 4) Net quantity in standard metric units, 5) Month and year of manufacture or pre-packing, 6) Retail sale price (MRP inclusive of all taxes), 7) Unit Sale Price where applicable, and 8) Name, address, telephone number, and email of the consumer grievance redressal cell.",
                "source": "Legal Metrology (Packaged Commodities) Rules 2011, Rule 6",
            },
            {
                "title": "MRP and Unit Sale Price Rule 6(1)(e)",
                "text": "Under Rule 6(1)(e) of Legal Metrology (Packaged Commodities) Rules 2011, the retail sale price shall clearly mention '(inclusive of all taxes)' and must be stated in Indian Rupees (₹ or Rs.). Unit Sale Price (per g, kg, ml, l, or number) is mandatory for packages containing more than one unit per the 2021 amendment (G.S.R. 779(E)).",
                "source": "Legal Metrology Rules 2011, Rule 6(1)(e)",
            },
            {
                "title": "Net Quantity Rule 6(1)(c)",
                "text": "Net quantity shall be declared in standard metric units: mass in grams (g) or kilograms (kg), volume in milliliters (ml) or liters (l), length in meters (m) or centimeters (cm). Non-metric units like lbs or oz are strictly prohibited.",
                "source": "Legal Metrology Rules 2011, Rule 6(1)(c)",
            },
            {
                "title": "Date of Manufacture and Expiry Rule 6(1)(d)",
                "text": "Every package must declare the month and year in which the commodity is manufactured or pre-packed. For commodities that may become unfit for human consumption after a period (such as food and cosmetics), the 'Best Before' or 'Use By' date is mandatory under FSSA 2006 and LMPC Rules.",
                "source": "Legal Metrology Rules 2011, Rule 6(1)(d)",
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
            {
                "title": "Packaging Classifications: Combination, Group, Multi-Piece",
                "text": "Under the Legal Metrology Rules (G.S.R. 722(E)): 1) 'Combination package' (Rule 2(ka)): Contains two or more individual pieces or packages of dissimilar commodities (e.g., spoon, fork, napkins). 2) 'Group package' (Rule 2(kb)): Contains two or more individual pieces or packages of similar, but not identical commodities differing in size, quantity, or variant. 3) 'Multi-piece package' (Rule 2(kc)): Contains two or more individual packages of the same commodities of identical quantity. Note: Unit Sale Price is exempted on combination, group, and multi-piece packages under the proviso to Rule 6(11).",
                "source": "Legal Metrology Rules 2011, Rule 2 & Rule 6(11) (G.S.R. 722(E))",
            },
            {
                "title": "Penalties for Non-Compliance",
                "text": "Under Section 36(1) of the Legal Metrology Act, 2009: Whoever manufactures, packs, sells, or distributes any pre-packaged commodity that does not conform to the declarations shall be punished with fine: 1) First offence: up to ₹25,000, 2) Second offence: up to ₹50,000, 3) Subsequent offences: up to ₹1,00,000 or imprisonment up to 1 year, or both.",
                "source": "Legal Metrology Act, 2009, Section 36(1)",
            },
            {
                "title": "Font Size and Principal Display Area",
                "text": "Under Rule 7 and Table 1 of LMPC Rules, minimum numeral height for net quantity and MRP depends on the Principal Display Area (PDA): PDA ≤ 50 cm²: 1.0 mm (0.5 mm for blow-moulded); 50 < PDA ≤ 100 cm²: 1.5 mm; 100 < PDA ≤ 500 cm²: 2.5 mm; 500 < PDA ≤ 2500 cm²: 4.0 mm; PDA > 2500 cm²: 6.0 mm. Minimum height-to-width ratio is 3:1.",
                "source": "Legal Metrology Rules 2011, Rule 7 & Schedule II",
            },
        ]
        self.vector_store.add_documents(faq_data)

    @staticmethod
    def _is_greeting(query: str) -> bool:
        q = query.strip().lower()
        greetings = {
            "hi", "hello", "hey", "namaste", "good morning", "good afternoon",
            "good evening", "help", "who are you", "what can you do", "how are you",
            "start", "menu", "hi there", "hello there", "hey there", "thanks",
            "thank you", "bye", "goodbye", "ok", "okay"
        }
        if q in greetings:
            return True
        words = q.split()
        if len(words) <= 2 and words[0] in {"hi", "hello", "hey", "namaste", "greetings"}:
            return True
        return False

    @staticmethod
    def _get_greeting_response() -> str:
        return (
            "### 👋 Welcome to PRAMAN AI Compliance Assistant\n\n"
            "I am your specialized statutory compliance guide for the **Legal Metrology (Packaged Commodities) Rules, 2011** and **FSSAI Packaging Norms**.\n\n"
            "---\n\n"
            "### 📋 What I Can Help You Audit:\n"
            "* **🔍 Mandatory Declarations**: Statutory requirements for **MRP**, **Net Quantity**, **FSSAI License**, **Manufacturer Details**, **Dates of Mfd/Expiry**, and **Consumer Care**.\n"
            "* **📦 Packaging Types**: Clear legal criteria and Unit Sale Price rules for **Combination Packages**, **Group Packages**, and **Multi-Piece Packages**.\n"
            "* **📏 Font & Display Specs**: Minimum numeral heights, display area ratios (PDA), and label layout standards under Rule 7.\n"
            "* **⚖️ Violations & Penalties**: Enforcement clauses and fine schedules under Section 36 of the Legal Metrology Act, 2009.\n\n"
            "---\n\n"
            "### 💡 Suggested Questions:\n"
            "* *\"What are the mandatory declarations required on pre-packaged goods?\"*\n"
            "* *\"What is the difference between a combination pack and a group pack?\"*\n"
            "* *\"What are the font size requirements for Net Quantity and MRP?\"*\n"
            "* *\"What are the statutory penalty clauses for non-compliant packaging?\"*"
        )

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

    def _build_structured_fallback(self, query: str, docs: List[Dict[str, Any]], scan_summary: str = "") -> str:
        """
        Builds a clean, professional English statutory response when LLM is unconfigured or unavailable.
        Filters out raw Hindi/Devanagari text and presents clean structured markdown.
        """
        import re
        q = query.lower()
        sections = []

        if scan_summary:
            sections.append(scan_summary)

        # 1. Package Classifications
        if any(w in q for w in ["combination", "group package", "multi-piece", "multipiece", "distinct product", "packaging type"]):
            sections.append(
                "### 📦 Statutory Packaging Classifications (Rule 2)\n\n"
                "Under the Legal Metrology (Packaged Commodities) Rules, 2011 (as amended):\n\n"
                "* **Combination Package (Rule 2(ka))**:\n"
                "  - Contains two or more individual pieces or packages of **dissimilar commodities** intended for retail sale (e.g., gift set of spoon, knife, fork, and cup).\n"
                "* **Group Package (Rule 2(kb))**:\n"
                "  - Contains two or more individual packages of **similar, but not identical commodities** differing in size, net quantity, appearance, or variant (e.g., assorted biscuit pack).\n"
                "* **Multi-Piece Package (Rule 2(kc))**:\n"
                "  - Contains two or more individual packaged pieces of the **exact same commodity with identical quantity** (e.g., 5 soap bars of 20g each).\n\n"
                "💡 **Unit Sale Price (USP) Exemption**: Under Rule 6(11) proviso, declaration of Unit Sale Price is **not mandatory** for combination, group, or multi-piece packages."
            )
            return "\n\n---\n\n".join(sections)

        # 2. Penalties and Fines
        if any(w in q for w in ["penalty", "fine", "punish", "offence", "offense", "section 36", "violation"]):
            sections.append(
                "### ⚖️ Statutory Penalties for Non-Compliance\n\n"
                "Under **Section 36(1) of the Legal Metrology Act, 2009**:\n\n"
                "* **First Offence**: Fine up to **₹25,000**.\n"
                "* **Second Offence**: Fine up to **₹50,000**.\n"
                "* **Subsequent Offences**: Fine up to **₹1,00,000**, or **imprisonment up to 1 year**, or both.\n\n"
                "Under **Section 36(2)**: Altering or tampering with the declared Maximum Retail Price (MRP) attracts a fine up to **₹50,000** (first offence) and up to **₹1,00,000** or imprisonment for subsequent offences."
            )
            return "\n\n---\n\n".join(sections)

        # 3. Font Size & Display Area
        if any(w in q for w in ["font", "height", "display area", "pda", "numeral"]):
            sections.append(
                "### 📏 Minimum Font Size & Principal Display Area (Rule 7)\n\n"
                "Under Rule 7 and Schedule II of Legal Metrology (Packaged Commodities) Rules, 2011:\n\n"
                "| Principal Display Area (PDA) | Minimum Numeral Height (General) | Minimum Height (Blow-Moulded) |\n"
                "|---|---|---|\n"
                "| **PDA ≤ 50 cm²** | 1.0 mm | 0.5 mm |\n"
                "| **50 cm² < PDA ≤ 100 cm²** | 1.5 mm | 1.0 mm |\n"
                "| **100 cm² < PDA ≤ 500 cm²** | 2.5 mm | 1.5 mm |\n"
                "| **500 cm² < PDA ≤ 2500 cm²** | 4.0 mm | 2.0 mm |\n"
                "| **PDA > 2500 cm²** | 6.0 mm | 3.0 mm |\n\n"
                "* All numerals and letters must maintain a minimum height-to-width ratio of **3:1**."
            )
            return "\n\n---\n\n".join(sections)

        # 4. Clean English Vector Docs
        clean_docs = [
            d for d in docs
            if not re.search(r'[\u0900-\u097F]', d.get("text", "")) and len(d.get("text", "").strip()) > 30
        ]

        if clean_docs:
            sections.append("### 📜 Relevant Statutory Provisions")
            for doc in clean_docs[:2]:
                title = doc.get("title", "Statutory Rule")
                text = doc.get("text", "").strip()
                source = doc.get("source", "")
                source_note = f" *(Source: {source})*" if source else ""
                sections.append(f"#### **{title}**{source_note}\n{text}")
        else:
            # Fallback to general statutory declarations summary
            sections.append(
                "### 📋 Mandatory Pre-Packaged Commodity Declarations (Rule 6)\n\n"
                "Every pre-packaged commodity intended for retail sale in India must conspicuously display:\n\n"
                "* **1. Manufacturer / Packer / Importer Details**: Full name and complete registered address (Rule 6(1)(a)).\n"
                "* **2. Generic or Common Name**: Accurate name of the commodity (Rule 6(1)(b)).\n"
                "* **3. Net Quantity**: In standard metric units (g, kg, ml, l) with required minimum font size (Rule 6(1)(c)).\n"
                "* **4. Manufacturing / Pre-Packing Date**: Month and year of manufacture or pre-packing (Rule 6(1)(d)).\n"
                "* **5. Retail Sale Price (MRP)**: Clearly stated as *'MRP ₹... (inclusive of all taxes)'* (Rule 6(1)(e)).\n"
                "* **6. Unit Sale Price (USP)**: Required where package contains multiple items or non-standard weights (Rule 6(1)(r)).\n"
                "* **7. Consumer Care Details**: Officer name, physical address, phone number, and email ID for grievances (Rule 6(2)).\n"
                "* **8. Country of Origin**: Mandatory for all imported products (Rule 6(1)(aa))."
            )

        return "\n\n---\n\n".join(sections)

    def answer_query(self, query: str, scan_context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Answers a user query using vector search over statutory provisions,
        enriched with Groq/Gemini LLM generation if configured,
        or structured English statutory templates if unconfigured or unavailable.
        """
        clean_query = query.strip()

        # 1. Instant Conversational & Greeting Filter (0 ms response, clean formatting)
        if self._is_greeting(clean_query):
            return {
                "answer": self._get_greeting_response(),
                "citations": ["Legal Metrology (Packaged Commodities) Rules, 2011"],
                "llm_generated": False,
            }

        retrieved_docs: List[Dict[str, Any]] = self.vector_store.search(clean_query, top_k=3)
        citations = [d.get("source") for d in (retrieved_docs or []) if d.get("source")]

        # Filter out Hindi / Devanagari text from retrieved docs
        import re
        english_docs = [
            d for d in (retrieved_docs or [])
            if not re.search(r'[\u0900-\u097F]', d.get("text", ""))
        ]
        context = "\n".join(f"- {d.get('title')}: {d.get('text')}" for d in english_docs)

        scan_summary = self._format_scan_context(scan_context) if scan_context else ""

        # 2. LLM Synthesis via Groq (primary)
        if settings.is_groq_configured:
            synthesized = self._synthesize_groq(clean_query, context, scan_context=scan_context)
            if synthesized:
                return {
                    "answer": synthesized,
                    "citations": citations or ["Legal Metrology Rules, 2011"],
                    "llm_generated": True,
                }
        elif not settings.is_gemini_configured:
            logger.info("No LLM configured; using clean structured statutory template.")

        # 3. Gemini LLM fallback if configured
        if settings.is_gemini_configured and self._client is None:
            self._init_gemini_client()

        if self._client is not None:
            try:
                prompt = self._build_prompt(clean_query, context, scan_context=scan_context)
                response = self._client.models.generate_content(
                    model=settings.GEMINI_MODEL,
                    contents=prompt,
                )
                if response and hasattr(response, "text") and response.text:
                    return {
                        "answer": response.text.strip(),
                        "citations": citations or ["Legal Metrology Rules, 2011"],
                        "llm_generated": True,
                    }
            except Exception as e:
                logger.warning("Gemini LLM generation failed (%s). Using structured template.", type(e).__name__)

        # 4. Clean, High-Quality English Statutory Template Fallback
        structured_answer = self._build_structured_fallback(clean_query, retrieved_docs, scan_summary=scan_summary)
        return {
            "answer": structured_answer,
            "citations": citations or ["Legal Metrology (Packaged Commodities) Rules, 2011"],
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
            "1. LANGUAGE: Respond EXCLUSIVELY in clear, professional English. NEVER output Hindi or Devanagari script under any circumstances.\n"
            "2. FORMATTING & NEATNESS:\n"
            "   - Structure your response cleanly with markdown section headers (###), bold topic labels, and structured bullet points.\n"
            "   - If classifying packaging types or comparing rules, use clean bullet points or clean markdown tables.\n"
            "   - For each statutory provision, cite the official English Rule and Gazette notification.\n"
            "3. STATUTORY DEFINITIONS:\n"
            "   - 'Combination package' (Rule 2(ka)): Contains two or more pieces/packages of DISSIMILAR commodities.\n"
            "   - 'Group package' (Rule 2(kb)): Contains two or more pieces/packages of SIMILAR, but NOT identical commodities.\n"
            "   - 'Multi-piece package' (Rule 2(kc)): Contains two or more packages of the SAME commodity with IDENTICAL quantity.\n"
            "   - Unit Sale Price (Rule 6(11) proviso): NOT required for combination, group, or multi-piece packages.\n"
            "4. COMPLETION: Keep the answer concise, fast to read, and fully completed without mid-sentence cuts."
        )

    def _synthesize_groq(self, query: str, context: str, scan_context: Optional[Dict[str, Any]] = None) -> Optional[str]:
        """
        Fast Groq synthesis with openai/gpt-oss-20b.
        """
        try:
            import httpx
        except ImportError:
            logger.warning("httpx is not installed; Groq synthesis unavailable.")
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
                                "Answer in clear, professional English. Never output Hindi or Devanagari characters. "
                                "Format cleanly with markdown headers, bold labels, and neat bullet points."
                            ),
                        },
                        {
                            "role": "user",
                            "content": self._build_prompt(query, context, scan_context=scan_context),
                        },
                    ],
                    "temperature": 0.1,
                    "max_tokens": 800,
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
                "Groq LLM generation failed (%s). Falling back to structured template.",
                type(e).__name__
            )
        return None
