"""
Honest baselines. statsforecast's SeasonalNaive/AutoETS are the recommended
lib in production; these pandas-only versions keep the scaffold dependency-light
and are what the incumbent gets compared against in Branch B (§2).
"""
from __future__ import annotations

import pandas as pd


def naive_forecast(series: pd.Series, horizon: int) -> float:
    """Last observed value, repeated."""
    return float(series.iloc[-1])


def seasonal_naive_forecast(series: pd.Series, horizon: int, season_length: int = 7) -> float:
    """Value from `horizon` steps back adjusted to the same day-of-week, i.e.
    value at t - season_length (repeated if horizon > season_length)."""
    idx = -((horizon - 1) % season_length + 1)
    if abs(idx) > len(series):
        return float(series.mean())
    return float(series.iloc[idx])


def moving_average_forecast(series: pd.Series, horizon: int, window: int = 28) -> float:
    return float(series.tail(window).mean())
