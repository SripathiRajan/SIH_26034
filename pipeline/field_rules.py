import re

# Mandatory declarations under Legal Metrology (Packaged Commodities) Rules 2011 (as amended) & FSS (Labelling and Display) Regulations 2020.
# Citations verified against the consolidated rule text:
#   6(1)(a) manufacturer; 6(1)(aa) country of origin (imports, 2017 Amdt); 6(1)(c) net quantity;
#   6(1)(d) month & year of manufacture; 6(1)(da) best before/use by (2017 Amdt); 6(1)(e) MRP; 6(2) consumer care.
MANDATORY_FIELDS = {
    "net_quantity": {
        "label": "Net Quantity",
        "pattern": re.compile(
            r"(?:(?:net\s*(?:quantity|qty|wt\.?|weight)?|weight|qty)\s*[:\-]?\s*(\d+[.,\d]*)\s*(g|gm|gms|g\.|kg|ml|l|ltr|litre|litres|m|cm|mm|oz|lb|count|units?|tablets?|capsules?|n|u)\b|"
            r"(?:net\s*(?:quantity|qty|wt\.?|weight)?)\s*[:\-]?\s*([^\n\r]{1,30}?)\s*(\d+[.,\d]*)\s*(g|gm|gms|g\.|kg|ml|l|ltr|litre|litres)\b)",
            re.IGNORECASE
        ),
        "rule": "LM Rule §6(1)(c) — Net quantity mandatory in standard metric units"
    },
    "mrp": {
        "label": "Maximum Retail Price (MRP)",
        "pattern": re.compile(
            r"(?:maximum\s+retail\s+price|mrp|m\.r\.p\.?)\s*(?:\(incl\.?\s*of\s*all\s*taxes?\))?"
            r"[ \t\:\-\.]*(?:rs\.?|₹|\?|inr)?[ \t\:\-\.]*([\d,]+\.?\d{1,2}|[\d,]+)|(?:\b(?:rs\.?|inr)|₹)[ \t]*([\d,]+\.?\d{1,2}|[\d,]+)",
            re.IGNORECASE
        ),
        "rule": "LM Rule §6(1)(e) — MRP inclusive of all taxes"
    },
    "manufacturer": {
        "label": "Manufacturer / Packer Name & Address",
        "pattern": re.compile(
            r"(?:manufactured(?:\s*&\s*marketed)?|marketed|packed|mfg|mfd)\s+by\s*[:\-]?\s*(.+?)(?:\n|lic|fssai|$)",
            re.IGNORECASE
        ),
        "rule": "LM Rule §6(1)(a) — Name and address of manufacturer/packer/importer"
    },
    "manufacture_date": {
        "label": "Month & Year of Manufacture",
        "pattern": re.compile(
            r"(?:mfg\.?\s*(?:date)?|manufactured\s*(?:on|date)?|packed\s*(?:on|date)?|date\s*of\s*(?:mfg|pkg|packing|packaging)\.?|dom|mfd|pkd(?:\s*on|\s*date)?)"
            r"[\s\:\.\-]*(?:[a-z0-9]{1,4}[\s\:\.\-]+)?"
            r"([a-z0-9]{2,}[\s\/\-\.]\d{2,4}|\d{1,2}[\/\-\.]\d{2,4}|\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}|\b\d{4}\b)",
            re.IGNORECASE
        ),
        "rule": "LM Rule §6(1)(d) — Month and year of manufacture/packing"
    },
    "use_by": {
        "label": "Use By / Best Before / Expiry",
        "pattern": re.compile(
            r"(?:use\s*by|best\s*before|expiry(?:\s*date)?|exp\.?\s*(?:date)?|expires?|bb\.?|valid\s*till)[\s\:\.\-]*"
            r"(?:[a-z0-9]{1,4}[\s\:\.\-]+)?"
            r"([a-z0-9]{2,}[\s\/\-\.]\d{2,4}|\d{1,2}[\/\-\.]\d{2,4}|\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}|\w+\/\d{2,4}|"
            r"(?:(?:one|two|three|four|five|six|seven|eight|nine|ten|twelve|eighteen|twenty\s*four|\d+)\s*(?:months?|days?|weeks?|years?)(?:\s+(?:from|of)\s+(?:pkg|mfg|packing|packaging|packging|manufacture|date))?))",
            re.IGNORECASE
        ),
        "rule": "LM Rule §6(1)(da) — Best before / use by date"
    },
    "consumer_care": {
        "label": "Consumer Care Details",
        "pattern": re.compile(
            r"(?:consumer|customer|helpline|care|contact|feedback|complaint)"
            r".{0,40}?(?:\+?91[\s\-]?\d[\d\s\-]{8,}|\d{10,}|\w+@[\w\.\-]+)",
            re.IGNORECASE
        ),
        "rule": "LM Rule §6(2) — Consumer care phone/email mandatory"
    },
    "fssai": {
        "label": "FSSAI License Number",
        "pattern": re.compile(
            r"(?:fssai|fsat|fssal|issai|lic(?:ense)?\.?\s*(?:no\.?)?|lic\s*#)[\s\S]{0,30}?[:\-]?\s*([0-9\s]{10,20})|\b([12]\d{13}|\d{14})\b",
            re.IGNORECASE
        ),
        "rule": "FSS (Labelling and Display) Regulations 2020 §2.1.1"
    },
    "country_of_origin": {
        "label": "Country of Origin",
        "pattern": re.compile(
            r"(?:country\s+of\s+origin|product\s+of|made\s+in|manufactured\s+in)\s*[:\-]?\s*([a-z]+)|(?:,\s*|\b)(india|bharat)\b",
            re.IGNORECASE
        ),
        "rule": "LM Rule §6(1)(aa) — Country of origin declaration"
    },
}

VLM_CRITICAL_FIELDS = {"mrp", "net_quantity", "fssai", "manufacturer", "manufacture_date", "use_by"}

FLAP_POINTER_PATTERN = re.compile(
    r"(?:see|refer|check|look\s+at|jee)\s+(?:the\s+)?(?:bottom|boom|botom|botton|btm|bttm|under|base|side|top|flap|container|seal|cap|pouch|neck|below)"
    r"(?:\s+(?:of|0f|o0)\s+(?:pack|package|podk|bottle|box|container|pouch))?",
    re.IGNORECASE
)
