import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from agents.guardrails import check_recommendation, requires_human_approval  # noqa: E402


def test_order_value_cap_flags():
    rec = {"recommended_qty": 5000, "evidence": {"confidence": 0.9}}
    out = check_recommendation(rec, unit_cost=10, running_daily_spend=0)
    assert "exceeds_order_value_cap" in out["guardrail_flags"]
    assert out["status"] == "escalated"


def test_low_confidence_escalates():
    rec = {"recommended_qty": 10, "evidence": {"confidence": 0.3}}
    out = check_recommendation(rec, unit_cost=10, running_daily_spend=0)
    assert "below_confidence_threshold" in out["guardrail_flags"]


def test_clean_recommendation_stays_pending():
    rec = {"recommended_qty": 10, "evidence": {"confidence": 0.9}}
    out = check_recommendation(rec, unit_cost=10, running_daily_spend=0)
    assert out["guardrail_flags"] == []
    assert out["status"] == "pending"


def test_missing_evidence_flagged():
    rec = {"recommended_qty": 10, "evidence": {}}
    out = check_recommendation(rec, unit_cost=10, running_daily_spend=0)
    assert "missing_evidence_citation" in out["guardrail_flags"]


def test_every_recommendation_requires_human_approval():
    assert requires_human_approval({"guardrail_flags": []}) is True
    assert requires_human_approval({"guardrail_flags": ["exceeds_order_value_cap"]}) is True
