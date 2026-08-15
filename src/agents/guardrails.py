"""
Guardrails: order-value cap, budget cap, confidence threshold -> auto-escalate
to human. Every recommendation must cite the rows/evidence it used. Nothing
reaches the Executor without passing a guardrail AND a human.
"""
from __future__ import annotations

MAX_ORDER_VALUE = 20000.0
MAX_DAILY_BUDGET = 100000.0
MIN_CONFIDENCE = 0.6  # below this, escalate rather than silently proceed


def check_recommendation(rec: dict, unit_cost: float, running_daily_spend: float) -> dict:
    """Returns the recommendation with guardrail_flags populated. A non-empty
    flag list forces human escalation instead of auto-execution."""
    flags = list(rec.get("guardrail_flags", []))
    order_value = rec.get("recommended_qty", 0) * unit_cost

    if order_value > MAX_ORDER_VALUE:
        flags.append("exceeds_order_value_cap")
    if running_daily_spend + order_value > MAX_DAILY_BUDGET:
        flags.append("exceeds_daily_budget")

    confidence = rec.get("evidence", {}).get("confidence", 1.0)
    if confidence < MIN_CONFIDENCE:
        flags.append("below_confidence_threshold")

    if not rec.get("evidence"):
        flags.append("missing_evidence_citation")

    rec = dict(rec)
    rec["guardrail_flags"] = flags
    rec["status"] = "escalated" if flags else rec.get("status", "pending")
    return rec


def requires_human_approval(rec: dict) -> bool:
    """Every recommendation requires human approval by design (§0 — 'for
    human approval' is the whole point). Guardrail flags just tell the human
    WHY this one needs extra scrutiny."""
    return True
