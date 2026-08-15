"""
Shared state schema passed between the 7 LangGraph nodes:
DataQuality -> Forecast -> Risk -> ReplenishmentPlanner -> GuardrailCheck
-> [human interrupt] -> Executor. Explainer and Analyst are auxiliary nodes.
"""
from __future__ import annotations

from typing import Any, Literal, TypedDict


class DataQualityFlag(TypedDict):
    check: str
    passed: bool
    detail: str


class Recommendation(TypedDict, total=False):
    rec_id: str
    store_id: str
    product_id: str
    on_hand: float
    reorder_point: float
    safety_stock: float
    recommended_qty: float
    stockout_risk_7d: float
    days_to_stockout: int
    cost_if_ignored: float
    cost_of_action: float
    net_benefit: float
    guardrail_flags: list[str]
    evidence: dict
    rationale: str
    status: Literal["pending", "approved", "rejected", "escalated"]


class PlanningState(TypedDict, total=False):
    run_id: str
    thread_id: str
    plan_date: str
    data_quality_flags: list[DataQualityFlag]
    forecasts: list[dict]
    risk_scores: list[dict]
    recommendations: list[Recommendation]
    pending_approval: list[Recommendation]
    approved: list[Recommendation]
    rejected: list[Recommendation]
    audit_log: list[dict]
    narrative: str
    error: str | None
