"""
The dual-agent layer, both powered by Grok (xAI).

  Proposer  — reads the deterministic evidence (numbers already computed by the
              forecasting + inventory code) and produces a plain-English
              recommendation plus a suggested decision (APPROVE / HOLD) and a
              confidence. It explains; it does not invent numbers.

  Verifier  — a separate, skeptical agent. It re-reads the SAME evidence and the
              Proposer's suggestion and independently cross-checks it: are the
              numbers self-consistent, does the suggested action match the sign
              of net_benefit and the guardrail flags, is the confidence justified?
              It returns AGREE or OVERRIDE with reasons.

Flow: Proposer suggests -> Verifier cross-verifies -> human approves. If the
Verifier overrides, or any guardrail fired, the item is escalated so the human
sees exactly why before acting.

Every function degrades honestly: if Grok is unavailable (no key / DEMO_MODE /
network), it returns a deterministic fallback with ai_available=False so the UI
can show an "AI unavailable" badge instead of pretending.
"""
from __future__ import annotations

import json

from .grok_client import GrokUnavailable, chat, chat_json, status

PROPOSER_SYSTEM = (
    "You are the Proposer agent in StockPilot, an inventory replenishment system. "
    "You are given EVIDENCE that was already computed by deterministic code: demand "
    "quantiles over the lead time, the recommended order quantity, days to stockout, "
    "the cost of acting vs ignoring, and any guardrail flags. "
    "Never invent or recompute numbers — only use the ones given. "
    "Recommend APPROVE when acting clearly beats ignoring (net_benefit > 0 and no "
    "blocking guardrail); recommend HOLD when the case is weak or a guardrail fired. "
    "Be crisp and professional."
)

VERIFIER_SYSTEM = (
    "You are the Verifier agent in StockPilot. A separate Proposer agent has suggested "
    "an action. Your job is to independently CROSS-CHECK it, not to agree by default. "
    "Using ONLY the given evidence, check: (1) does the suggested decision match the sign "
    "of net_benefit, (2) do any guardrail flags make APPROVE unsafe, (3) is the stated "
    "confidence consistent with days_to_stockout and stockout risk, (4) are the numbers "
    "internally consistent. If anything is off, OVERRIDE. Prefer OVERRIDE to a human when "
    "uncertain. Be terse and specific."
)


def _fallback_proposal(evidence: dict) -> dict:
    qty = evidence.get("recommended_qty", "?")
    days = evidence.get("days_to_stockout", "?")
    store = evidence.get("store_id", "this store")
    product = str(evidence.get("product_id", "this SKU"))[:8]
    driver = (evidence.get("top_drivers") or ["demand trend"])[0]
    flags = evidence.get("guardrail_flags") or []
    net = float(evidence.get("net_benefit", 0) or 0)
    decision = "APPROVE" if (net > 0 and not flags) else "HOLD"
    rationale = (
        f"Order {qty} units of {product} at {store} — demand risk is driven by "
        f"{str(driver).replace('_', ' ')}, and stockout is ~{days} days away at the "
        f"current run rate."
    )
    return {"decision": decision, "confidence": 0.6, "rationale": rationale,
            "ai_available": False}


def _fallback_verdict(evidence: dict, proposal: dict) -> dict:
    flags = evidence.get("guardrail_flags") or []
    net = float(evidence.get("net_benefit", 0) or 0)
    suggested = (proposal or {}).get("decision", "HOLD")
    # deterministic cross-check mirroring the proposer's rule
    expected = "APPROVE" if (net > 0 and not flags) else "HOLD"
    agree = suggested == expected
    reasons = []
    if flags:
        reasons.append(f"guardrail flags present: {', '.join(flags)}")
    if net <= 0:
        reasons.append("net_benefit is not positive")
    if not reasons:
        reasons.append("net_benefit positive and no guardrail flags")
    return {"verdict": "AGREE" if agree else "OVERRIDE",
            "final_decision": expected,
            "reasons": reasons,
            "ai_available": False}


from pydantic import BaseModel
from typing import Literal, List

class ProposalResponse(BaseModel):
    decision: Literal["APPROVE", "HOLD"]
    confidence: float
    rationale: str

class VerdictResponse(BaseModel):
    verdict: Literal["AGREE", "OVERRIDE"]
    final_decision: Literal["APPROVE", "HOLD"]
    reasons: List[str]

def propose(evidence: dict) -> dict:
    """Proposer agent. Returns {decision, confidence, rationale, ai_available}."""
    user = (
        "EVIDENCE (already computed, do not change):\n"
        + json.dumps(evidence, indent=2)
    )
    try:
        out_model = chat_json(PROPOSER_SYSTEM, user, temperature=0.2, name="proposer-agent",
                              metadata={"agent": "proposer"}, pydantic_model=ProposalResponse)
        out = out_model.model_dump()
        out["ai_available"] = True
        return out
    except (GrokUnavailable, ValueError, KeyError):
        return _fallback_proposal(evidence)


def verify(evidence: dict, proposal: dict) -> dict:
    """Verifier agent. Returns {verdict, final_decision, reasons, ai_available}."""
    user = (
        "EVIDENCE:\n" + json.dumps(evidence, indent=2)
        + "\n\nPROPOSER SUGGESTED:\n" + json.dumps(
            {"decision": proposal.get("decision"), "confidence": proposal.get("confidence"),
             "rationale": proposal.get("rationale")}, indent=2)
    )
    try:
        out_model = chat_json(VERIFIER_SYSTEM, user, temperature=0.1, name="verifier-agent",
                              metadata={"agent": "verifier"}, pydantic_model=VerdictResponse)
        out = out_model.model_dump()
        out["ai_available"] = True
        return out
    except (GrokUnavailable, ValueError, KeyError):
        return _fallback_verdict(evidence, proposal)


def analyze(evidence: dict) -> dict:
    """Run the full Proposer -> Verifier exchange for one recommendation.

    Returns everything the UI needs to show the two agents debating, plus the
    resolved status the human should act on.
    """
    proposal = propose(evidence)
    verdict = verify(evidence, proposal)
    ai_available = bool(proposal.get("ai_available") and verdict.get("ai_available"))

    final = verdict.get("final_decision", "HOLD")
    escalated = (final != "APPROVE") or bool(evidence.get("guardrail_flags"))
    return {
        "proposer": proposal,
        "verifier": verdict,
        "resolved_decision": final,
        "status": "escalated" if escalated else "pending",
        "ai_available": ai_available,
        "grok": status(),
    }
