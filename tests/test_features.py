"""
Tests for src/data/features.py build_features(con, origin_date) — the Olist
seller x day feature builder. Verifies the no-future-leakage contract from
CONTRACTS.md and docs/data_quality_report.md.
"""
from __future__ import annotations

import os
import sys

import duckdb
import pandas as pd
import pytest

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, os.path.join(REPO_ROOT, "src", "data"))

from load_data import DUCKDB_PATH_DEFAULT  # noqa: E402
from features import build_features  # noqa: E402

# High-volume seller active across the whole dataset window — used for
# spot-checks below (see quality_analysis: 1987 items, 2017-01-08..2018-08-27).
SPOT_SELLER = "4a3ca9315b744ce9f8e9374361493884"

ORIGIN_DATE = "2018-06-01"


@pytest.fixture(scope="module")
def con():
    if not os.path.exists(DUCKDB_PATH_DEFAULT):
        pytest.skip(f"olist.duckdb not found at {DUCKDB_PATH_DEFAULT}; run src/data/load_data.py first")
    connection = duckdb.connect(DUCKDB_PATH_DEFAULT, read_only=True)
    yield connection
    connection.close()


@pytest.fixture(scope="module")
def features_df(con):
    return build_features(con, ORIGIN_DATE)


def test_output_non_empty(features_df):
    assert len(features_df) > 0


def test_no_row_after_origin_date(features_df):
    origin = pd.Timestamp(ORIGIN_DATE).normalize()
    assert (features_df["day"] <= origin).all()


def test_no_discount_promo_weather_columns(features_df):
    forbidden = ("discount", "promo", "weather")
    lowered = [c.lower() for c in features_df.columns]
    for term in forbidden:
        matches = [c for c in lowered if term in c]
        assert not matches, f"found forbidden term '{term}' in columns: {matches}"


def test_lead_time_sample_count_never_decreases(con):
    earlier = build_features(con, "2017-06-01")
    later = build_features(con, "2018-06-01")

    e_row = earlier[earlier["seller_id"] == SPOT_SELLER]
    l_row = later[later["seller_id"] == SPOT_SELLER]
    assert not e_row.empty and not l_row.empty, "spot-check seller missing from one of the two origin dates"

    lt_n_earlier = e_row["lt_n"].iloc[0]
    lt_n_later = l_row["lt_n"].iloc[0]
    assert lt_n_later >= lt_n_earlier


def test_lag_1_matches_manual_shift(con):
    seller_df = build_features(con, ORIGIN_DATE)
    seller_df = seller_df[seller_df["seller_id"] == SPOT_SELLER].sort_values("day").reset_index(drop=True)
    assert len(seller_df) > 28, "spot-check seller has too few days to validate lag_1"

    manual_lag1 = seller_df["n_items"].shift(1)
    pd.testing.assert_series_equal(
        seller_df["lag_1"].reset_index(drop=True),
        manual_lag1.reset_index(drop=True),
        check_names=False,
    )
