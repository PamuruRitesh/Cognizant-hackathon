"""
Seller x day feature builder for the real Olist dataset.

This is the real-data replacement for the Day-1 mock/scaffold feature
builder (`build_features(df, origin_date, horizon)`) that targeted the
synthetic Kaggle `retail_store_inventory.csv`. That prior version is
superseded for this data path; `build_features` here has a different
signature (`con, origin_date`) because it reads directly from the DuckDB
tables loaded by `src/data/load_data.py` rather than a single flat CSV.

`build_features(con, origin_date)` physically truncates every query at
`origin_date` — no row or computed feature may reference a timestamp after
it. The seller's historical lead-time distribution (`lt_mean`, `lt_std`,
`lt_p50`, `lt_p90`, `lt_n`) is likewise a snapshot computed only from orders
purchased AND delivered on or before `origin_date`, restricted to orders
that pass the timestamp-sequence checks in docs/data_quality_report.md
(section 7) — violating orders are excluded, never silently repaired.

`Discount`, `Promotion flag`, and `Weather Condition` do not exist in the
Olist dataset (see docs/data_quality_report.md section 11) and are never
fabricated here as proxies.
"""
from __future__ import annotations

import numpy as np
import pandas as pd
import holidays

LAGS = (1, 7, 14, 28)
ROLLING_WINDOWS = (7, 28)

BR_HOLIDAYS = holidays.Brazil(years=range(2016, 2019))

# The valid-sequence predicate from docs/data_quality_report.md section 7,
# reused here so the lead-time snapshot matches the quality report exactly.
_VALID_SEQUENCE_SQL = """
    o.order_approved_at IS NOT NULL
    AND o.order_delivered_carrier_date IS NOT NULL
    AND o.order_approved_at >= o.order_purchase_timestamp
    AND o.order_delivered_carrier_date >= o.order_approved_at
    AND o.order_delivered_customer_date >= o.order_delivered_carrier_date
"""


def _daily_seller_activity(con, origin_end: pd.Timestamp) -> pd.DataFrame:
    """Raw seller x day rows (only days with >=1 item) truncated at origin_date."""
    query = f"""
        SELECT
            oi.seller_id AS seller_id,
            CAST(o.order_purchase_timestamp AS DATE) AS day,
            COUNT(*) AS n_items,
            AVG(oi.price) AS avg_price,
            AVG(oi.freight_value) AS avg_freight
        FROM order_items oi
        JOIN orders o ON o.order_id = oi.order_id
        WHERE o.order_purchase_timestamp <= ?
        GROUP BY oi.seller_id, day
    """
    return con.execute(query, [origin_end]).df()


def _lead_time_snapshot(con, origin_end: pd.Timestamp) -> pd.DataFrame:
    """Per-seller lt_mean/lt_std/lt_p50/lt_p90/lt_n as of origin_date.

    Only orders purchased AND delivered on or before origin_date, and only
    those passing the timestamp-sequence validity checks, are included.
    """
    query = f"""
        SELECT
            oi.seller_id AS seller_id,
            EXTRACT(EPOCH FROM (o.order_delivered_customer_date - o.order_purchase_timestamp)) / 86400.0 AS lt_days
        FROM order_items oi
        JOIN orders o ON o.order_id = oi.order_id
        WHERE o.order_status = 'delivered'
          AND o.order_purchase_timestamp <= ?
          AND o.order_delivered_customer_date <= ?
          AND {_VALID_SEQUENCE_SQL}
    """
    lt = con.execute(query, [origin_end, origin_end]).df()
    if lt.empty:
        return pd.DataFrame(columns=["seller_id", "lt_mean", "lt_std", "lt_p50", "lt_p90", "lt_n"])

    grp = lt.groupby("seller_id")["lt_days"]
    stats = grp.agg(["mean", "std", "count"])
    stats.columns = ["lt_mean", "lt_std", "lt_n"]
    stats["lt_p50"] = grp.quantile(0.50)
    stats["lt_p90"] = grp.quantile(0.90)
    return stats.reset_index()[["seller_id", "lt_mean", "lt_std", "lt_p50", "lt_p90", "lt_n"]]


def _build_daily_panel(raw: pd.DataFrame, origin_day: pd.Timestamp) -> pd.DataFrame:
    """Expand sparse per-seller activity rows into a dense seller x day grid.

    Each seller's grid runs from their own first active day through
    origin_day (inclusive), zero-filling n_items on days with no items.
    """
    raw = raw.copy()
    raw["day"] = pd.to_datetime(raw["day"])

    frames = []
    for seller_id, g in raw.groupby("seller_id", sort=False):
        start = g["day"].min()
        idx = pd.date_range(start, origin_day, freq="D")
        gi = g.set_index("day").reindex(idx)
        gi.index.name = "day"
        gi["seller_id"] = seller_id
        gi["n_items"] = gi["n_items"].fillna(0)
        frames.append(gi.reset_index())

    panel = pd.concat(frames, ignore_index=True)
    return panel.sort_values(["seller_id", "day"]).reset_index(drop=True)


def _add_lags_and_rollups(panel: pd.DataFrame) -> pd.DataFrame:
    panel = panel.copy()
    grp = panel.groupby("seller_id")["n_items"]
    for lag in LAGS:
        panel[f"lag_{lag}"] = grp.shift(lag)

    # Shift by 1 first so the rolling window excludes the current day, then
    # re-group the shifted series for the rolling call so windows never
    # cross seller boundaries.
    panel["_shift1"] = grp.shift(1)
    for window in ROLLING_WINDOWS:
        shifted_grp = panel.groupby("seller_id")["_shift1"]
        panel[f"roll_mean_{window}"] = shifted_grp.transform(lambda s: s.rolling(window).mean())
        panel[f"roll_std_{window}"] = shifted_grp.transform(lambda s: s.rolling(window).std())
    panel = panel.drop(columns="_shift1")
    return panel


def _add_calendar_features(panel: pd.DataFrame) -> pd.DataFrame:
    panel = panel.copy()
    panel["day_of_week"] = panel["day"].dt.dayofweek
    panel["is_weekend"] = panel["day_of_week"].isin([5, 6]).astype(int)
    panel["month"] = panel["day"].dt.month
    panel["is_holiday"] = panel["day"].dt.date.isin(BR_HOLIDAYS).astype(int)
    return panel


def _add_price_features(panel: pd.DataFrame) -> pd.DataFrame:
    panel = panel.copy()
    freight = panel["avg_freight"].replace(0, np.nan)
    panel["price_over_freight_ratio"] = panel["avg_price"] / freight
    return panel


def build_features(con, origin_date) -> pd.DataFrame:
    """Build the seller_id x day feature table, truncated at origin_date.

    `con` is a DuckDB connection with the tables loaded by
    `src/data/load_data.py` (orders, order_items, ...). `origin_date` is the
    forecast origin — no row or computed feature may reference any
    timestamp after it.
    """
    origin_day = pd.Timestamp(origin_date).normalize()
    origin_end = origin_day + pd.Timedelta(hours=23, minutes=59, seconds=59)

    raw = _daily_seller_activity(con, origin_end)
    if raw.empty:
        return raw

    panel = _build_daily_panel(raw, origin_day)
    panel = _add_lags_and_rollups(panel)
    panel = _add_calendar_features(panel)
    panel = _add_price_features(panel)

    lt_stats = _lead_time_snapshot(con, origin_end)
    panel = panel.merge(lt_stats, on="seller_id", how="left")
    panel["lt_n"] = panel["lt_n"].fillna(0).astype(int)

    assert (panel["day"] <= origin_day).all(), "build_features produced a row after origin_date"

    return panel
