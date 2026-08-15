"""
Safety-stock math — quantiles are not additive.

WRONG: SS = P90_LT - P50_LT where P90_LT sums daily P90s. Summing L daily P90s
gives the comonotonic upper bound, not the 90th percentile of lead-time demand.
For roughly independent daily errors the true quantile of the sum grows like
sqrt(L), not L — over a 3-day lead time you'd over-order by ~40-70%.

RIGHT: use WS-1's aggregate-target quantile model (forecasts_lt.parquet),
which forecasts the quantiles of the SUM of demand over the protection
interval directly.

  protection_interval = lead_time + review_period   (review_period = 1 for daily review)
  ROP = Q_alpha(D over protection_interval)          <- straight from the aggregate model
  SS  = ROP - E[D over protection_interval]           <- a DERIVED display number, not the primitive
  order_up_to S = Q_alpha(D over protection_interval)
  order_qty = max(0, S - inventory_position)
"""
from __future__ import annotations

from dataclasses import dataclass


@dataclass
class ProtectionIntervalQuantiles:
    p50_lt: float  # median of demand over the protection interval
    p_alpha_lt: float  # alpha-quantile of demand over the protection interval (e.g. p90_lt for 90% service)


def reorder_point(pi: ProtectionIntervalQuantiles) -> float:
    """ROP = Q_alpha(D over L+R), straight from the aggregate quantile model."""
    return pi.p_alpha_lt


def safety_stock(pi: ProtectionIntervalQuantiles) -> float:
    """Derived display number, not the primitive: ROP - E[D over L+R].
    We use the median as a practical stand-in for the mean under right skew."""
    return reorder_point(pi) - pi.p50_lt


def order_up_to_level(pi: ProtectionIntervalQuantiles) -> float:
    return pi.p_alpha_lt


def order_quantity(
    pi: ProtectionIntervalQuantiles,
    inventory_position: float,
    moq: float = 0.0,
    pack_size: float = 1.0,
    budget_cap_units: float | None = None,
) -> dict:
    """Order-up-to quantity with MOQ / pack-size / budget constraints enforced
    as hard constraints — violations become guardrail flags, not silent
    adjustments."""
    raw_qty = max(0.0, order_up_to_level(pi) - inventory_position)

    flags = []
    qty = raw_qty
    if pack_size > 1:
        qty = pack_size * round(qty / pack_size)
    if qty > 0 and qty < moq:
        flags.append("below_moq_rounded_up")
        qty = moq
    if budget_cap_units is not None and qty > budget_cap_units:
        flags.append("exceeds_budget_cap")
        qty = budget_cap_units

    return {"raw_qty": round(raw_qty, 2), "final_qty": round(qty, 2), "guardrail_flags": flags}


def protection_interval_days(lead_time_days: int, review_period_days: int = 1) -> int:
    """The protection interval is L + R, not L — say the words in the demo."""
    return lead_time_days + review_period_days
