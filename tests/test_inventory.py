import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from inventory.safety_stock import (  # noqa: E402
    ProtectionIntervalQuantiles,
    reorder_point,
    safety_stock,
    order_quantity,
    protection_interval_days,
)
from inventory.cost_model import holding_cost, stockout_cost  # noqa: E402
from inventory.simulator import simulate_arm, compare_arms  # noqa: E402


def test_protection_interval_is_lead_time_plus_review():
    assert protection_interval_days(lead_time_days=3, review_period_days=1) == 4


def test_reorder_point_uses_aggregate_quantile_not_summed_daily():
    pi = ProtectionIntervalQuantiles(p50_lt=80, p_alpha_lt=118)
    assert reorder_point(pi) == 118  # straight from the aggregate model, not L * daily_p90


def test_safety_stock_is_derived_not_primitive():
    pi = ProtectionIntervalQuantiles(p50_lt=80, p_alpha_lt=118)
    assert safety_stock(pi) == 38


def test_order_quantity_respects_moq_and_budget():
    pi = ProtectionIntervalQuantiles(p50_lt=80, p_alpha_lt=118)
    result = order_quantity(pi, inventory_position=100, moq=30, budget_cap_units=10)
    assert result["final_qty"] == 10
    assert "exceeds_budget_cap" in result["guardrail_flags"]


def test_order_quantity_zero_when_above_order_up_to():
    pi = ProtectionIntervalQuantiles(p50_lt=80, p_alpha_lt=118)
    result = order_quantity(pi, inventory_position=200)
    assert result["final_qty"] == 0


def test_holding_and_stockout_cost_nonnegative():
    assert holding_cost(100, 10.0) >= 0
    assert stockout_cost(5, 20.0) >= 0


def test_three_arm_simulator_shares_dynamics_and_ranks_sensibly():
    demand = [50, 60, 55, 70, 65, 40, 30]
    # Arm A orders little (mimics under-ordering current practice)
    arm_a = simulate_arm("A", demand, order_series=[0, 0, 0, 0, 0, 0, 0], initial_on_hand=60,
                          lead_time_days=2, unit_cost=10, unit_margin=15)
    # Arm C orders proactively to match demand
    arm_c = simulate_arm("C", demand, order_series=[60, 60, 60, 60, 60, 0, 0], initial_on_hand=60,
                          lead_time_days=2, unit_cost=10, unit_margin=15)
    arm_b = simulate_arm("B", demand, order_series=[30, 30, 30, 30, 30, 0, 0], initial_on_hand=60,
                          lead_time_days=2, unit_cost=10, unit_margin=15)

    assert arm_c.stockout_days <= arm_a.stockout_days
    comparison = compare_arms(arm_a, arm_b, arm_c)
    assert "C_vs_A_system_lift" in comparison
    assert "C_vs_B_forecast_lift" in comparison
