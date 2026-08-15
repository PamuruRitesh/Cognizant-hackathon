"""
Cost assumptions — configurable, exposed as sliders so the conclusion doesn't
depend on one guess. See docs/inventory_math.md for the written-out formulas.
"""
from __future__ import annotations

DEFAULT_HOLDING_RATE_ANNUAL = 0.25  # 25%/yr of unit cost
DEFAULT_GOODWILL_MULTIPLIER = 1.2


def holding_cost(units_on_hand: float, unit_cost: float, annual_rate: float = DEFAULT_HOLDING_RATE_ANNUAL) -> float:
    """Pro-rated daily holding cost."""
    daily_rate = annual_rate / 365.0
    return units_on_hand * unit_cost * daily_rate


def stockout_cost(
    units_short: float,
    unit_margin: float,
    goodwill_multiplier: float = DEFAULT_GOODWILL_MULTIPLIER,
) -> float:
    """Lost margin x units short x goodwill multiplier."""
    return max(0.0, units_short) * unit_margin * goodwill_multiplier
