from fastapi import APIRouter, Query

from ..data_access import load_recommendations

router = APIRouter(tags=["kpis"])


@router.get("/kpis")
def get_kpis(date: str | None = Query(default=None)):
    recs = load_recommendations()
    pending = [r for r in recs if r["status"] == "pending"]
    at_risk_value = sum(r["cost_if_ignored"] for r in pending)
    return {
        "date": date,
        "stockout_risk_skus": len([r for r in pending if r["stockout_risk_7d"] > 0.5]),
        "value_at_risk": round(at_risk_value, 2),
        "pending_approvals": len(pending),
        "avg_forecast_accuracy_lift_pct": 18.4,  # placeholder until WS-1's leaderboard lands
    }
