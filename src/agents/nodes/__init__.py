"""
The 7 core nodes, written as plain functions of PlanningState first so they're
independently testable, then wired into a LangGraph StateGraph in graph.py.
Order: DataQuality -> Forecast -> Risk -> ReplenishmentPlanner -> GuardrailCheck
-> [human interrupt] -> Executor. Explainer and Analyst are auxiliary nodes
called from ReplenishmentPlanner / the API layer respectively.

Each node calls functions the other workstreams wrote (WS-1 forecasts, WS-2
inventory math) — this file orchestrates, it does not reimplement any math.
"""
from __future__ import annotations

import json
import os
from datetime import datetime, timezone

from ..guardrails import check_recommendation
from ..llm import explain
from ..state import PlanningState

MOCKS_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "..", "mocks")


def data_quality_node(state: PlanningState) -> PlanningState:
    """Runs WS-1's Day-1 audits and surfaces flags. In the stub, reads a
    pre-computed report; wire to docs/data_quality_report.md once real data lands."""
    flags = [
        {"check": "incumbent_not_a_feature", "passed": True, "detail": "excluded by contract + test"},
        {"check": "negative_forecast_values", "passed": False, "detail": "incumbent has values as low as -10"},
        {"check": "stock_conservation", "passed": False, "detail": "inventory column doesn't balance; simulator uses its own state"},
    ]
    state["data_quality_flags"] = flags
    return state


def forecast_node(state: PlanningState) -> PlanningState:
    """Reads forecasts.parquet (or mocks/forecasts.parquet as a stand-in)."""
    try:
        import pandas as pd

        df = pd.read_parquet(os.path.join(MOCKS_DIR, "forecasts.parquet"))
        state["forecasts"] = df.head(50).to_dict(orient="records")
    except Exception as e:  # pragma: no cover
        state["forecasts"] = []
        state["error"] = f"forecast_node: {e}"
    return state


def risk_node(state: PlanningState) -> PlanningState:
    """Scores days-to-stockout / stockout risk from forecast + on-hand."""
    risk_scores = []
    for f in state.get("forecasts", [])[:20]:
        risk_scores.append(
            {
                "store_id": f.get("store_id"),
                "product_id": f.get("product_id"),
                "stockout_risk_7d": min(1.0, f.get("p90", 0) / max(f.get("p10", 1), 1) / 5),
            }
        )
    state["risk_scores"] = risk_scores
    return state


def replenishment_planner_node(state: PlanningState) -> PlanningState:
    """Calls WS-2's inventory functions (via mocks/recommendations.json in
    the stub) and attaches an Explainer narrative to each recommendation."""
    with open(os.path.join(MOCKS_DIR, "recommendations.json")) as f:
        recs = json.load(f)
    for r in recs:
        r["rationale"] = explain(r["evidence"] | {"product_id": r["product_id"], "store_id": r["store_id"],
                                                     "recommended_qty": r["recommended_qty"],
                                                     "days_to_stockout": r["days_to_stockout"]})
    state["recommendations"] = recs
    return state


def guardrail_check_node(state: PlanningState) -> PlanningState:
    checked = []
    running_spend = 0.0
    for r in state.get("recommendations", []):
        r2 = check_recommendation(r, unit_cost=15.0, running_daily_spend=running_spend)
        running_spend += r2.get("recommended_qty", 0) * 15.0
        checked.append(r2)
    state["recommendations"] = checked
    state["pending_approval"] = [r for r in checked if r["status"] in ("pending", "escalated")]
    return state


def human_approval_interrupt(state: PlanningState) -> PlanningState:
    """This is where LangGraph's interrupt() pauses execution and persists
    (state, thread_id) to the checkpointer. Streamlit's approval queue reads
    pending_approval and POSTs /approve or /reject, which resumes the graph
    by thread_id in a FastAPI background task. See graph.py."""
    return state


def executor_node(state: PlanningState) -> PlanningState:
    """Writes the PO + audit log entry for every approved recommendation."""
    audit_log = state.get("audit_log", [])
    for r in state.get("approved", []):
        audit_log.append(
            {
                "rec_id": r["rec_id"],
                "action": "purchase_order_created",
                "qty": r["recommended_qty"],
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
        )
    state["audit_log"] = audit_log
    return state
