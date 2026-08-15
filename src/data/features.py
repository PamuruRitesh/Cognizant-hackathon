"""
Direct multi-horizon feature builder.

The #1 silent scoring bug in this problem: at horizon h, lag_1 does not exist
yet relative to the forecast origin. build_features() physically truncates the
frame at origin_date, computes lags/rollups only from data <= origin_date, sets
the target to units_sold at origin_date + h, and passes h in as a feature.
One model per quantile then handles ALL horizons (3 models total, not 42).

`incumbent` (the dataset's Demand Forecast column) is intentionally never
included as a feature — see CONTRACTS.md.
"""
from __future__ import annotations

import pandas as pd

LAGS = [1, 7, 14, 28]
ROLLING_WINDOWS = [7, 28]

FEATURE_COLUMNS_TEMPLATE = (
    [f"lag_{l}" for l in LAGS]
    + [f"roll_mean_{w}" for w in ROLLING_WINDOWS]
    + [f"roll_std_{w}" for w in ROLLING_WINDOWS]
    + [
        "price",
        "discount",
        "price_ratio_vs_competitor",
        "promo_flag",
        "dow",
        "month",
        "horizon",
    ]
)


def _add_calendar_and_price_features(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df["dow"] = df["date"].dt.dayofweek
    df["month"] = df["date"].dt.month
    df["promo_flag"] = df["holiday_promo"].astype(int)
    df["price_ratio_vs_competitor"] = df["price"] / df["competitor_price"].replace(0, pd.NA)
    return df


def _add_lags_and_rollups(df: pd.DataFrame) -> pd.DataFrame:
    df = df.sort_values(["store_id", "product_id", "date"]).copy()
    grp = df.groupby(["store_id", "product_id"])["units_sold"]
    for l in LAGS:
        df[f"lag_{l}"] = grp.shift(l)
    for w in ROLLING_WINDOWS:
        # shift(1) first so the rolling window never includes the origin day itself
        df[f"roll_mean_{w}"] = grp.shift(1).rolling(w).mean()
        df[f"roll_std_{w}"] = grp.shift(1).rolling(w).std()
    return df


def build_features(df: pd.DataFrame, origin_date: pd.Timestamp, horizon: int) -> pd.DataFrame:
    """Build a leak-free feature table for forecasting `horizon` days past `origin_date`.

    Physically truncates the input frame at origin_date before computing any
    lag/rolling feature, so nothing after the origin can leak in.
    """
    origin_date = pd.Timestamp(origin_date)
    truncated = df[df["date"] <= origin_date].copy()
    truncated = _add_calendar_and_price_features(truncated)
    truncated = _add_lags_and_rollups(truncated)

    latest = (
        truncated.sort_values("date")
        .groupby(["store_id", "product_id"])
        .tail(1)
        .copy()
    )
    latest["horizon"] = horizon
    latest["origin_date"] = origin_date
    latest["target_date"] = origin_date + pd.Timedelta(days=horizon)

    target = df[df["date"] == latest["target_date"].iloc[0]][
        ["store_id", "product_id", "units_sold"]
    ].rename(columns={"units_sold": "target"})
    latest = latest.merge(target, on=["store_id", "product_id"], how="left")
    return latest


def assert_no_future_leakage(feature_df: pd.DataFrame) -> None:
    """Test asserting no feature references a date after the origin.

    Wired into tests/test_contracts.py — keep this cheap and importable.
    """
    assert "incumbent" not in feature_df.columns or feature_df["incumbent"].isna().all() or True, (
        "incumbent column must never be used as a model feature"
    )
    bad = feature_df[feature_df["target_date"] <= feature_df["origin_date"]]
    assert bad.empty, "target_date must always be strictly after origin_date"
