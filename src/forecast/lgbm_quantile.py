"""
LightGBM quantile model, P10/P50/P90. Direct multi-horizon: horizon is a
feature, one model per quantile (3 total), trained on the origin-truncated
feature table from src/data/features.py.

Monotone constraints: +1 on discount, -1 on price — tree models otherwise
extrapolate flat and aren't monotone in any feature, so a What-If discount
slider can produce nonsensical (demand-down-on-discount) results without this.
"""
from __future__ import annotations

from typing import Dict

import numpy as np
import pandas as pd

try:
    import lightgbm as lgb
except ImportError:  # pragma: no cover - optional at scaffold time
    lgb = None

from .metrics import rearrange_quantiles

QUANTILES = {"p10": 0.1, "p50": 0.5, "p90": 0.9}

MONOTONE_MAP = {
    "discount": 1,
    "price": -1,
}


def _monotone_constraints(feature_columns: list[str]) -> list[int]:
    return [MONOTONE_MAP.get(c, 0) for c in feature_columns]


def train_quantile_models(
    train_df: pd.DataFrame, feature_columns: list[str], target_col: str = "target"
) -> Dict[str, "lgb.LGBMRegressor"]:
    if lgb is None:
        raise ImportError("pip install lightgbm --break-system-packages")

    X = train_df[feature_columns]
    y = train_df[target_col]
    constraints = _monotone_constraints(feature_columns)

    models = {}
    for name, q in QUANTILES.items():
        model = lgb.LGBMRegressor(
            objective="quantile",
            alpha=q,
            n_estimators=300,
            learning_rate=0.05,
            monotone_constraints=constraints,
            verbosity=-1,
        )
        model.fit(X, y)
        models[name] = model
    return models


def predict_quantiles(models: Dict[str, "lgb.LGBMRegressor"], X: pd.DataFrame) -> pd.DataFrame:
    p10 = models["p10"].predict(X)
    p50 = models["p50"].predict(X)
    p90 = models["p90"].predict(X)
    p10, p50, p90 = rearrange_quantiles(np.asarray(p10), np.asarray(p50), np.asarray(p90))
    return pd.DataFrame({"p10": p10, "p50": p50, "p90": p90})


def predict_with_overrides(
    models: Dict[str, "lgb.LGBMRegressor"],
    feature_row: pd.DataFrame,
    feature_columns: list[str],
    overrides: dict | None = None,
    training_ranges: dict[str, tuple[float, float]] | None = None,
) -> dict:
    """The What-If simulator entry point (WS-1 ships, WS-3 + WS-4 call).

    overrides may contain: price, discount, promo_flag, weather, lead_time.
    Every override is clamped to the observed training range.
    """
    row = feature_row.copy()
    clamped_notes = []
    overrides = overrides or {}
    training_ranges = training_ranges or {}
    for k, v in overrides.items():
        if k not in row.columns:
            continue
        lo, hi = training_ranges.get(k, (None, None))
        clamped_v = v
        if lo is not None and hi is not None:
            clamped_v = min(max(v, lo), hi)
            if clamped_v != v:
                clamped_notes.append(f"{k} clamped {v} -> {clamped_v}")
        row[k] = clamped_v

    preds = predict_quantiles(models, row[feature_columns])
    return {
        "p10": float(preds["p10"].iloc[0]),
        "p50": float(preds["p50"].iloc[0]),
        "p90": float(preds["p90"].iloc[0]),
        "clamped": clamped_notes,
    }
