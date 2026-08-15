"""
Metric hygiene — get these exactly right, they're one-question kills.
"""
from __future__ import annotations

import numpy as np


def wape(actual: np.ndarray, pred: np.ndarray) -> float:
    """Sum|error| / Sum|actual| — NOT the mean of per-row APEs (that's MAPE,
    and it explodes on low-volume rows)."""
    actual, pred = np.asarray(actual, dtype=float), np.asarray(pred, dtype=float)
    denom = np.abs(actual).sum()
    if denom == 0:
        return float("nan")
    return float(np.abs(actual - pred).sum() / denom)


def mase(actual: np.ndarray, pred: np.ndarray, train_series: np.ndarray, season_length: int = 7) -> float:
    """Scale-free error. Denominator = in-sample one-step seasonal-naive (m=7)
    error computed on the TRAINING set — never on the test window, or folds
    become incomparable and the metric meaningless."""
    actual, pred = np.asarray(actual, dtype=float), np.asarray(pred, dtype=float)
    train_series = np.asarray(train_series, dtype=float)
    naive_errors = np.abs(train_series[season_length:] - train_series[:-season_length])
    scale = naive_errors.mean()
    if scale == 0 or np.isnan(scale):
        return float("nan")
    return float(np.abs(actual - pred).mean() / scale)


def bias(actual: np.ndarray, pred: np.ndarray) -> float:
    actual, pred = np.asarray(actual, dtype=float), np.asarray(pred, dtype=float)
    return float((pred - actual).mean())


def pinball_loss(actual: np.ndarray, pred: np.ndarray, quantile: float) -> float:
    """Applies to quantile models only. Baselines and the incumbent get 'n/a'."""
    actual, pred = np.asarray(actual, dtype=float), np.asarray(pred, dtype=float)
    diff = actual - pred
    return float(np.mean(np.maximum(quantile * diff, (quantile - 1) * diff)))


def coverage(actual: np.ndarray, lower: np.ndarray, upper: np.ndarray) -> float:
    """Empirical coverage of a [lower, upper] interval. Used for the Day-3
    calibration gate: P90 should cover ~90% of actuals, +/- 5pp."""
    actual, lower, upper = np.asarray(actual, dtype=float), np.asarray(lower, dtype=float), np.asarray(upper, dtype=float)
    return float(((actual >= lower) & (actual <= upper)).mean())


def rearrange_quantiles(p10: np.ndarray, p50: np.ndarray, p90: np.ndarray):
    """Fix quantile crossing by row-wise sorting (rearrangement) — provably
    never worse than the unsorted estimates. Clip at 0 after."""
    stacked = np.sort(np.stack([p10, p50, p90], axis=1), axis=1)
    stacked = np.clip(stacked, 0, None)
    return stacked[:, 0], stacked[:, 1], stacked[:, 2]
