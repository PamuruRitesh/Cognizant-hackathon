"""
Dual-agent endpoints.

  GET  /api/agent-status                       -> is Grok reachable right now?
  POST /api/recommendations/{rec_id}/analyze   -> run Proposer + Verifier live

The analyze endpoint runs the two Grok agents on demand so the demo can show
them working live. If Grok is unavailable it still returns a deterministic
result with ai_available=false, so the UI shows an "AI unavailable" badge
rather than an error or a fake.
"""
from fastapi import APIRouter, Depends, HTTPException

from ..data_access import load_recommendations
from ..auth import User, require_roles
from ...agents.dual_agents import analyze
from ...agents.grok_client import status, ping

router = APIRouter(tags=["agents"])


@router.get("/agent-status")
def agent_status():
    return ping()


@router.post("/recommendations/{rec_id}/analyze")
def analyze_recommendation(rec_id: str, _: User = Depends(require_roles("PLANNER", "ADMIN"))):
    recs = load_recommendations()
    rec = next((r for r in recs if r.get("rec_id") == rec_id), None)
    if rec is None:
        raise HTTPException(404, "rec_id not found")

    evidence = dict(rec.get("evidence") or {})
    evidence.update({
        "store_id": rec.get("store_id"),
        "product_id": rec.get("product_id"),
        "recommended_qty": rec.get("recommended_qty"),
        "days_to_stockout": rec.get("days_to_stockout"),
        "net_benefit": rec.get("net_benefit"),
        "cost_if_ignored": rec.get("cost_if_ignored"),
        "cost_of_action": rec.get("cost_of_action"),
        "stockout_risk_7d": rec.get("stockout_risk_7d"),
        "guardrail_flags": rec.get("guardrail_flags") or [],
    })
    result = analyze(evidence)
    result["rec_id"] = rec_id
    return result
