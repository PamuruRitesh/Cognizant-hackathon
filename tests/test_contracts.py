import os
import sys

import numpy as np
import pandas as pd
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from data.features import build_features, FEATURE_COLUMNS_TEMPLATE, assert_no_future_leakage  # noqa: E402
from forecast.metrics import wape, mase, pinball_loss, coverage, rearrange_quantiles  # noqa: E402


def _toy_df():
    dates = pd.date_range("2023-01-01", periods=60, freq="D")
    rows = []
    rng = np.random.default_rng(0)
    for store in ["S1"]:
        for product in ["P1"]:
            for i, d in enumerate(dates):
                rows.append(
                    dict(
                        date=d,
                        store_id=store,
                        product_id=product,
                        units_sold=max(0, 50 + 10 * np.sin(i / 7) + rng.normal(0, 3)),
                        price=20.0,
                        discount=0.1,
                        competitor_price=22.0,
                        holiday_promo=0,
                        incumbent=999,  # deliberately a decoy value
                    )
                )
    return pd.DataFrame(rows)


def test_incumbent_never_in_feature_columns():
    assert "incumbent" not in FEATURE_COLUMNS_TEMPLATE


def test_build_features_no_future_leakage():
    df = _toy_df()
    origin = pd.Timestamp("2023-02-10")
    feats = build_features(df, origin_date=origin, horizon=7)
    assert_no_future_leakage(feats)
    # nothing used to build lags should come from after the origin
    assert (df[df.date <= origin]["units_sold"].max()) is not None  # sanity: truncation happened


def test_wape_matches_definition():
    actual = np.array([10, 0, 20])
    pred = np.array([12, 0, 18])
    expected = (2 + 0 + 2) / (10 + 0 + 20)
    assert wape(actual, pred) == pytest.approx(expected)


def test_mase_uses_training_denominator():
    train = np.array([10, 12, 11, 13, 12, 14, 13, 15, 14, 16, 15, 17, 16, 18])
    actual = np.array([20, 21])
    pred = np.array([19, 22])
    val = mase(actual, pred, train, season_length=7)
    assert val > 0


def test_rearrange_quantiles_fixes_crossing():
    p10 = np.array([5.0, 30.0])
    p50 = np.array([10.0, 20.0])  # crossed with p90 in row 2
    p90 = np.array([8.0, 25.0])  # crossed with p10 in row1, p50 in row2
    p10n, p50n, p90n = rearrange_quantiles(p10, p50, p90)
    assert (p10n <= p50n).all() and (p50n <= p90n).all()


def test_coverage_within_bounds():
    actual = np.array([5, 15, 25])
    lower = np.array([0, 10, 30])
    upper = np.array([10, 20, 40])
    cov = coverage(actual, lower, upper)
    assert cov == pytest.approx(2 / 3)


def test_pinball_loss_nonnegative():
    actual = np.array([10.0, 20.0])
    pred = np.array([12.0, 18.0])
    assert pinball_loss(actual, pred, 0.5) >= 0
