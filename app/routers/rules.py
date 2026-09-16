"""
Rules Router
Provides statutory Legal Metrology rules database for compliance officers.
"""

import os
import json
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

router = APIRouter(prefix="/api/rules", tags=["Rules Database"])

RULES_FILE = os.path.join(os.path.dirname(os.path.dirname(__file__)), "validation", "rules_db.json")

class RuleModel(BaseModel):
    id: str
    section: str
    title: str
    summary: str
    fullText: str
    amendment: Optional[str] = None
    penalty: Optional[str] = None
    category: str
    tags: List[str] = []


def _load_rules() -> List[dict]:
    if os.path.exists(RULES_FILE):
        with open(RULES_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return []


@router.get("", response_model=List[RuleModel])
def get_all_rules(
    category: Optional[str] = Query(None, description="Filter by category"),
    search: Optional[str] = Query(None, description="Keyword search across title, summary, section, and tags"),
):
    rules = _load_rules()
    if category and category != "all":
        rules = [r for r in rules if r.get("category", "").lower() == category.lower()]
    if search:
        s = search.lower().strip()
        rules = [
            r for r in rules
            if s in r.get("title", "").lower()
            or s in r.get("section", "").lower()
            or s in r.get("summary", "").lower()
            or any(s in tag.lower() for tag in r.get("tags", []))
        ]
    return rules


@router.get("/{rule_id}", response_model=RuleModel)
def get_rule_by_id(rule_id: str):
    rules = _load_rules()
    target = rule_id.lower().strip()
    for r in rules:
        if r.get("id", "").lower() == target or r.get("section", "").lower().replace(" ", "") == target.replace(" ", ""):
            return r
    raise HTTPException(status_code=404, detail=f"Rule '{rule_id}' not found")
