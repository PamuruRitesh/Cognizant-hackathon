"""
Day 1, hour 1 audits (§2 of the plan). Run BEFORE any modeling. These four
checks decide your entire narrative — do them first, write both branches.
"""
from __future__ import annotations

import numpy as np
import pandas as pd


def incumbent_leak_report(df: pd.DataFrame) -> dict:
    """corr(Units Sold, Demand Forecast) and WAPE(incumbent, actual).

    This decides the Day-1 branch:
      Branch A: incumbent WAPE > 15%  -> beat it, say so.
      Branch B: incumbent WAPE < 10%  -> reframe as an oracle upper bound,
                report seasonal-naive / AutoETS as the honest baselines instead.
    """
    corr = float(np.corrcoef(df["units_sold"], df["incumbent"])[0, 1])
    wape = float((df["incumbent"] - df["units_sold"]).abs().sum() / df["units_sold"].abs().sum())
    branch = "A (beat it)" if wape > 0.15 else "B (oracle ceiling — do not compete against it)"
    return {"corr_units_sold_incumbent": round(corr, 4), "incumbent_wape": round(wape, 4), "branch": branch}


def stock_conservation_check(df: pd.DataFrame) -> dict:
    """Test Inv_t - Inv_{t-1} + UnitsSold_t - UnitsOrdered_{t-1} ~= 0 per store x product.

    Expected: does NOT hold in this synthetic dataset. That's fine — say so
    first, and simulate inventory yourself from a common initial on-hand
    instead of anchoring to this column (see src/inventory/simulator.py).
    """
    g = df.sort_values(["store_id", "product_id", "date"]).copy()
    g["inv_prev"] = g.groupby(["store_id", "product_id"])["inventory_level"].shift(1)
    g["ordered_prev"] = g.groupby(["store_id", "product_id"])["units_ordered"].shift(1)
    g = g.dropna(subset=["inv_prev", "ordered_prev"])
    residual = g["inventory_level"] - g["inv_prev"] + g["units_sold"] - g["ordered_prev"]
    holds_pct = float((residual.abs() < 1e-6).mean())
    return {
        "conservation_holds_fraction": round(holds_pct, 4),
        "mean_abs_residual": round(float(residual.abs().mean()), 2),
        "conclusion": "holds" if holds_pct > 0.95 else "does NOT hold — simulate inventory ourselves, don't anchor to this column",
    }


def negative_forecast_check(df: pd.DataFrame) -> dict:
    n_negative = int((df["incumbent"] < 0).sum())
    return {
        "n_negative_incumbent_rows": n_negative,
        "min_incumbent": float(df["incumbent"].min()),
        "flag": n_negative > 0,
    }


def censoring_check(df: pd.DataFrame) -> dict:
    """Stockout events: Inventory Level == 0, or sales exactly exhaust start-of-day stock.

    State your stock-timing convention explicitly — the answer depends on it.
    """
    zero_inv_days = int((df["inventory_level"] == 0).sum())
    exhausts_stock = int((df["units_sold"] >= df["inventory_level"]).sum())
    total = len(df)
    return {
        "convention": "start-of-day inventory_level compared against same-day units_sold",
        "zero_inventory_days": zero_inv_days,
        "zero_inventory_pct": round(100 * zero_inv_days / total, 3),
        "sales_exhaust_stock_days": exhausts_stock,
        "sales_exhaust_stock_pct": round(100 * exhausts_stock / total, 3),
        "censored": (zero_inv_days / total) > 0.01,
    }


def run_all_day1_audits(df: pd.DataFrame) -> dict:
    return {
        "leak_report": incumbent_leak_report(df),
        "stock_conservation": stock_conservation_check(df),
        "negative_forecast": negative_forecast_check(df),
        "censoring": censoring_check(df),
        "n_series": int(df.groupby(["store_id", "product_id"]).ngroups),
        "n_rows": int(len(df)),
        "date_range": [str(df["date"].min().date()), str(df["date"].max().date())],
    }


if __name__ == "__main__":
    from loader import load_raw

    df = load_raw()
    report = run_all_day1_audits(df)
    import json

    print(json.dumps(report, indent=2))
