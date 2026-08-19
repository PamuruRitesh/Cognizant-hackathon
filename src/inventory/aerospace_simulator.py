"""
Three-arm policy simulator — customized for Aerospace (Isolated from Olist).

Run three arms with IDENTICAL inventory dynamics, identical starting on-hand,
identical lead time:

  Arm A - Static rule:                  order a fixed qty (seller's historical mean demand) every day
  Arm B - Incumbent forecast + policy:  same (s,S) machinery, fed by `incumbent`
  Arm C - StockPilot:                   our quantiles + our policy
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Callable

from .cost_model import holding_cost, stockout_cost


@dataclass
class AerospaceDayResult:
    day: int
    on_hand_start: float
    demand: float
    units_sold: float
    stockout_units: float
    order_placed: float
    on_hand_end: float
    holding_cost: float
    stockout_cost: float


@dataclass
class AerospaceSimulationResult:
    arm_name: str
    days: list[AerospaceDayResult] = field(default_factory=list)

    @property
    def total_holding_cost(self) -> float:
        return sum(d.holding_cost for d in self.days)

    @property
    def total_stockout_cost(self) -> float:
        return sum(d.stockout_cost for d in self.days)

    @property
    def total_cost(self) -> float:
        return self.total_holding_cost + self.total_stockout_cost

    @property
    def stockout_days(self) -> int:
        return sum(1 for d in self.days if d.stockout_units > 0)

    @property
    def avg_on_hand(self) -> float:
        return sum(d.on_hand_end for d in self.days) / len(self.days) if self.days else 0.0


def simulate_aerospace_arm(
    arm_name: str,
    demand_series: list[float],
    order_series: list[float] | None,
    initial_on_hand: float,
    lead_time_days: int,
    unit_cost: float,
    unit_margin: float,
    order_policy: Callable[[int, float, float], float] | None = None,
) -> AerospaceSimulationResult:
    """Shared inventory-dynamics function used by ALL THREE arms."""
    n = len(demand_series)
    on_hand = initial_on_hand
    pipeline: dict[int, float] = {}  # arrival_day -> qty
    result = AerospaceSimulationResult(arm_name=arm_name)

    for t in range(n):
        arriving = pipeline.pop(t, 0.0)
        on_hand_start = on_hand + arriving

        demand = demand_series[t]
        units_sold = min(on_hand_start, demand)
        stockout_units = max(0.0, demand - on_hand_start)
        on_hand_end = max(0.0, on_hand_start - demand)

        if order_policy is not None:
            pipeline_qty = sum(pipeline.values())
            order_qty = order_policy(t, on_hand_end, pipeline_qty)
        else:
            order_qty = order_series[t] if order_series and t < len(order_series) else 0.0
        if order_qty > 0:
            pipeline[t + lead_time_days] = pipeline.get(t + lead_time_days, 0.0) + order_qty

        hcost = holding_cost(on_hand_end, unit_cost)
        scost = stockout_cost(stockout_units, unit_margin)

        result.days.append(
            AerospaceDayResult(
                day=t,
                on_hand_start=on_hand_start,
                demand=demand,
                units_sold=units_sold,
                stockout_units=stockout_units,
                order_placed=order_qty,
                on_hand_end=on_hand_end,
                holding_cost=hcost,
                stockout_cost=scost,
            )
        )
        on_hand = on_hand_end

    return result


def compare_aerospace_arms(arm_a: AerospaceSimulationResult, arm_b: AerospaceSimulationResult, arm_c: AerospaceSimulationResult) -> dict:
    def lift(base: AerospaceSimulationResult, challenger: AerospaceSimulationResult) -> dict:
        cost_delta = base.total_cost - challenger.total_cost
        stockout_delta = base.stockout_days - challenger.stockout_days
        inv_delta_pct = (
            100 * (base.avg_on_hand - challenger.avg_on_hand) / base.avg_on_hand
            if base.avg_on_hand
            else 0.0
        )
        return {
            "net_benefit": round(cost_delta, 2),
            "stockout_days_reduced": stockout_delta,
            "avg_inventory_change_pct": round(inv_delta_pct, 2),
        }

    return {
        "C_vs_B_forecast_lift": lift(arm_b, arm_c),
        "C_vs_A_system_lift": lift(arm_a, arm_c),
        "totals": {
            "A_current_practice": arm_a.total_cost,
            "B_incumbent_forecast": arm_b.total_cost,
            "C_stockpilot": arm_c.total_cost,
        },
    }
