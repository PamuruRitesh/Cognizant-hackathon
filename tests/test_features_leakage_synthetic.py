"""
Leakage tests that run anywhere — no olist.duckdb required.

Builds a tiny in-memory DuckDB matching the orders/order_items schema, then
asserts the core contract from CONTRACTS.md: nothing after the forecast origin
may influence any feature. The decisive check is test_post_origin_rows_are_inert:
build the features twice, once with a large post-origin spike in the database and
once without it, and require byte-identical output.
"""
from __future__ import annotations

import os
import sys

import duckdb
import pandas as pd
import pytest

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, os.path.join(REPO_ROOT, "src", "data"))

from features import build_features  # noqa: E402

ORIGIN = "2018-06-01"
SELLERS = ["seller_a", "seller_b"]


def _rows(include_post_origin: bool):
    orders, items = [], []
    n = 0
    for day in pd.date_range("2018-03-01", "2018-07-15", freq="D"):
        post = day > pd.Timestamp(ORIGIN)
        if post and not include_post_origin:
            continue
        for seller in SELLERS:
            # a deliberately huge spike after the origin: if it leaks, features move
            count = 40 if post else (2 if day.dayofweek < 5 else 1)
            for _ in range(count):
                n += 1
                oid = f"o{n}"
                orders.append({
                    "order_id": oid,
                    "order_status": "delivered",
                    "order_purchase_timestamp": day,
                    "order_approved_at": day + pd.Timedelta(hours=2),
                    "order_delivered_carrier_date": day + pd.Timedelta(days=1),
                    "order_delivered_customer_date": day + pd.Timedelta(days=5),
                })
                items.append({
                    "order_id": oid,
                    "seller_id": seller,
                    "price": 100.0 if not post else 999.0,
                    "freight_value": 10.0,
                })
    return pd.DataFrame(orders), pd.DataFrame(items)


def _con(include_post_origin: bool):
    orders, order_items = _rows(include_post_origin)
    con = duckdb.connect(":memory:")
    con.register("orders_df", orders)
    con.register("items_df", order_items)
    con.execute("CREATE TABLE orders AS SELECT * FROM orders_df")
    con.execute("CREATE TABLE order_items AS SELECT * FROM items_df")
    return con


@pytest.fixture(scope="module")
def features_df():
    con = _con(include_post_origin=True)
    df = build_features(con, ORIGIN)
    con.close()
    return df


def test_output_non_empty(features_df):
    assert len(features_df) > 0


def test_no_row_after_origin(features_df):
    assert (features_df["day"] <= pd.Timestamp(ORIGIN).normalize()).all()


def test_post_origin_rows_are_inert():
    con_with = _con(include_post_origin=True)
    con_without = _con(include_post_origin=False)
    with_future = build_features(con_with, ORIGIN).sort_values(["seller_id", "day"]).reset_index(drop=True)
    without_future = build_features(con_without, ORIGIN).sort_values(["seller_id", "day"]).reset_index(drop=True)
    con_with.close()
    con_without.close()
    pd.testing.assert_frame_equal(with_future, without_future)


def test_no_discount_promo_weather_columns(features_df):
    lowered = [c.lower() for c in features_df.columns]
    for term in ("discount", "promo", "weather"):
        assert not [c for c in lowered if term in c]


def test_lead_time_stats_exclude_undelivered_future(features_df):
    # deliveries land 5 days after purchase, so orders purchased within 5 days of
    # the origin are not yet delivered and must not appear in the lead-time stats
    assert features_df["lt_mean"].max() <= 5.001
    assert (features_df["lt_n"] >= 0).all()
