"""
Feature Engineering for Aerospace Supply Chain Forecasting.

Builds leakage-free tabular features from DuckDB / Pandas tables.
Features:
- Autoregressive lags: lag_1 (7d), lag_2 (14d), lag_4 (28d), lag_8 (56d), lag_12 (84d)
- Rolling window statistics: roll_mean_4, roll_std_4, roll_mean_8, roll_std_8, roll_mean_12, roll_std_12
- Calendar features: month, week_of_year, quarter, day_of_month, day_of_week
- Part & Supplier features: unit_cost, lead_time_days, is_repairable, part_family, criticality_class, supplier_risk_class
- Domain context: planned_maintenance, lag_1_on_hand_qty, lag_1_backorder_qty, lag_1_blocked_qty

Strict Leakage Prevention:
- Rolling windows computed strictly on shifted series (shift(1)) so current period actual is never in feature windows.
- Grouping by (site_id, part_id) ensures no boundary cross-contamination.
"""
from __future__ import annotations

import os
from typing import List, Tuple
import duckdb
import numpy as np
import pandas as pd

TARGET_COL = "consumption_qty"

LAG_STEPS = [1, 2, 4, 8, 12]
ROLLING_WINDOWS = [4, 8, 12]

NUMERIC_STATIC_COLS = ["unit_cost", "lead_time_days", "is_repairable"]
CATEGORICAL_COLS = ["part_family", "criticality_class", "supplier_risk_class"]
CALENDAR_COLS = ["month", "week_of_year", "quarter", "day_of_month", "day_of_week"]
DOMAIN_COLS = ["planned_maintenance", "lag_1_on_hand_qty", "lag_1_backorder_qty", "lag_1_blocked_qty"]


def extract_base_dataset(con: duckdb.DuckDBPyConnection) -> pd.DataFrame:
    """Extract joined panel dataset from DuckDB."""
    query = """
        SELECT 
            sch.date,
            sch.site_id,
            sch.part_id,
            sch.planned_maintenance,
            sch.consumption_qty,
            sch.on_hand_qty,
            sch.backorder_qty,
            sch.blocked_qty,
            pm.part_family,
            pm.criticality_class,
            pm.unit_cost,
            pm.lead_time_days,
            pm.supplier_id_primary,
            pm.supplier_risk_class,
            pm.is_repairable
        FROM supply_chain_history sch
        JOIN parts_master pm ON sch.part_id = pm.part_id
        ORDER BY sch.site_id, sch.part_id, sch.date
    """
    df = con.execute(query).df()
    df["date"] = pd.to_datetime(df["date"])
    df["series_id"] = df["site_id"] + "_" + df["part_id"]
    df["is_repairable"] = df["is_repairable"].astype(int)
    df["planned_maintenance"] = df["planned_maintenance"].astype(int)
    return df


def engineer_features(df: pd.DataFrame) -> Tuple[pd.DataFrame, List[str]]:
    """Generate all temporal, calendar, part, and domain features without leakage."""
    df = df.sort_values(["series_id", "date"]).reset_index(drop=True)
    
    # 1. Lags on Target (consumption_qty)
    grp_target = df.groupby("series_id")[TARGET_COL]
    for lag in LAG_STEPS:
        df[f"lag_{lag}"] = grp_target.shift(lag)

    # 2. Rolling statistics on strictly shifted series
    df["_shift1"] = grp_target.shift(1)
    grp_shift1 = df.groupby("series_id")["_shift1"]
    for w in ROLLING_WINDOWS:
        df[f"roll_mean_{w}"] = grp_shift1.transform(lambda s: s.rolling(w, min_periods=1).mean())
        df[f"roll_std_{w}"] = grp_shift1.transform(lambda s: s.rolling(w, min_periods=2).std()).fillna(0.0)
    df = df.drop(columns=["_shift1"])

    # 3. Calendar features
    df["month"] = df["date"].dt.month
    df["week_of_year"] = df["date"].dt.isocalendar().week.astype(int)
    df["quarter"] = df["date"].dt.quarter
    df["day_of_month"] = df["date"].dt.day
    df["day_of_week"] = df["date"].dt.dayofweek

    # 4. Domain lagged inventory features
    grp_on_hand = df.groupby("series_id")["on_hand_qty"]
    grp_backorder = df.groupby("series_id")["backorder_qty"]
    grp_blocked = df.groupby("series_id")["blocked_qty"]
    
    df["lag_1_on_hand_qty"] = grp_on_hand.shift(1)
    df["lag_1_backorder_qty"] = grp_backorder.shift(1)
    df["lag_1_blocked_qty"] = grp_blocked.shift(1)

    # 5. Categorical encodings (frequency / integer encoding)
    cat_feature_cols = []
    for col in CATEGORICAL_COLS:
        encoded_col = f"{col}_enc"
        df[encoded_col] = df[col].astype("category").cat.codes
        cat_feature_cols.append(encoded_col)

    # Build final list of feature columns
    lag_cols = [f"lag_{lag}" for lag in LAG_STEPS]
    roll_cols = [f"roll_mean_{w}" for w in ROLLING_WINDOWS] + [f"roll_std_{w}" for w in ROLLING_WINDOWS]
    
    feature_cols = (
        lag_cols
        + roll_cols
        + CALENDAR_COLS
        + NUMERIC_STATIC_COLS
        + cat_feature_cols
        + DOMAIN_COLS
    )

    # Fill initial warm-up NAs for lags with 0
    for col in feature_cols:
        df[col] = df[col].fillna(0.0)

    return df, feature_cols
