"""
Forecasting pipeline: trains quantile LightGBM models, evaluates baselines,
and backtests across rolling folds.

Two hard rules enforced here:
1. The panel is truncated at the last day of real marketplace activity.
   Olist order volume collapses after late Aug 2018 (Sept total = 1 item);
   evaluating in that dead zone produces perfect-looking, meaningless scores.
2. Multi-step prediction is recursive. Inside a 14-day test window, lag and
   rolling features are recomputed from the model's own earlier predictions,
   never from test-window actuals the model could not have known.
"""
from __future__ import annotations

import json
import os

import joblib
import numpy as np
import pandas as pd
import shap

from src.forecast.baselines import naive_forecast, seasonal_naive_forecast, moving_average_forecast
from src.forecast.lgbm_quantile import train_quantile_models
from src.forecast.metrics import mae, rmse, smape, wape, coverage, rearrange_quantiles, pinball_loss

FOLDS = [
    {"name": "fold_1", "train_end": 56, "test_start": 55, "test_end": 42},
    {"name": "fold_2", "train_end": 42, "test_start": 41, "test_end": 28},
    {"name": "fold_3", "train_end": 28, "test_start": 27, "test_end": 14},
    {"name": "holdout", "train_end": 14, "test_start": 13, "test_end": 0},
]

LAG_COLS = ["lag_1", "lag_7", "lag_14", "lag_28", "roll_mean_7", "roll_std_7", "roll_mean_28", "roll_std_28"]
EXOG_COLS = [
    "avg_price", "avg_freight", "day_of_week", "is_weekend", "month", "is_holiday",
    "price_over_freight_ratio", "lt_mean", "lt_std", "lt_p50", "lt_p90", "lt_n",
]
FEATURE_COLS = EXOG_COLS[:2] + LAG_COLS + EXOG_COLS[2:]
TARGET = "n_items"
OUT_DIR = "data/processed"
# A seller counts as "active" if it averages at least this many items/day in
# TRAINING data. Conditioning on a predictor, not on the outcome.
ACTIVE_MIN_DAILY = 0.10


def truncate_dead_zone(df: pd.DataFrame) -> pd.DataFrame:
    daily = df.groupby("day")[TARGET].sum()
    threshold = 0.2 * daily.rolling(90, min_periods=30).median()
    alive = daily[daily >= threshold.fillna(0)]
    cutoff = alive.index.max()
    print(f"Activity cutoff: {cutoff.date()} (dropping {(df['day'] > cutoff).sum()} dead-zone rows)")
    return df[df["day"] <= cutoff].copy()


def _lag_features(hist: np.ndarray) -> dict:
    n = hist.shape[1]
    out = {}
    for lag in (1, 7, 14, 28):
        out[f"lag_{lag}"] = hist[:, n - lag] if n >= lag else np.zeros(hist.shape[0])
    for w in (7, 28):
        tail = hist[:, max(0, n - w):]
        out[f"roll_mean_{w}"] = tail.mean(axis=1)
        out[f"roll_std_{w}"] = tail.std(axis=1, ddof=1) if tail.shape[1] > 1 else np.zeros(hist.shape[0])
    return out


def recursive_predict(models, train_wide: pd.DataFrame, test_df: pd.DataFrame) -> pd.DataFrame:
    sellers = train_wide.index.to_numpy()
    hist = train_wide.to_numpy(dtype=float)
    rows = []
    for day in sorted(test_df["day"].unique()):
        day_rows = test_df[test_df["day"] == day].set_index("seller_id")
        day_rows = day_rows.reindex(sellers)
        feats = pd.DataFrame(_lag_features(hist), index=sellers)
        for c in EXOG_COLS:
            feats[c] = day_rows[c].fillna(0).to_numpy()
        X = feats[FEATURE_COLS]
        p10 = models["p10"].predict(X)
        p50 = models["p50"].predict(X)
        p90 = models["p90"].predict(X)
        rows.append(pd.DataFrame({
            "seller_id": sellers, "day": day,
            "pred_p10_raw": p10, "pred_p50_raw": p50, "pred_p90_raw": p90,
        }))
        hist = np.hstack([hist, np.clip(p50, 0, None).reshape(-1, 1)])
    return pd.concat(rows, ignore_index=True)


def run_pipeline(data_path: str = "data/processed/features.parquet"):
    df = pd.read_parquet(data_path)
    df["day"] = pd.to_datetime(df["day"])
    df = truncate_dead_zone(df)
    for col in FEATURE_COLS:
        if df[col].isnull().any():
            df[col] = df[col].fillna(0)

    max_date = df["day"].max()
    wide = df.pivot_table(index="seller_id", columns="day", values=TARGET, fill_value=0.0)

    all_metrics, final_forecasts = [], None
    for fold in FOLDS:
        train_end = max_date - pd.Timedelta(days=fold["train_end"])
        test_start = max_date - pd.Timedelta(days=fold["test_start"])
        test_end = max_date - pd.Timedelta(days=fold["test_end"])
        print(f"\n--- {fold['name']}: train <= {train_end.date()}, test {test_start.date()}..{test_end.date()} ---")

        train_df = df[df["day"] <= train_end]
        test_df = df[(df["day"] >= test_start) & (df["day"] <= test_end)].copy()
        if test_df.empty:
            continue

        train_wide = wide.loc[:, wide.columns <= train_end]
        for seller_id, group in test_df.groupby("seller_id"):
            history = train_wide.loc[seller_id] if seller_id in train_wide.index else pd.Series([0.0])
            group = group.sort_values("day")
            for i, idx in enumerate(group.index, start=1):
                test_df.loc[idx, "pred_naive"] = naive_forecast(history, horizon=i)
                test_df.loc[idx, "pred_snaive"] = seasonal_naive_forecast(history, horizon=i, season_length=7)
                test_df.loc[idx, "pred_ma"] = moving_average_forecast(history, horizon=i, window=28)

        models = train_quantile_models(train_df, FEATURE_COLS, TARGET)
        preds = recursive_predict(models, train_wide, test_df)
        test_df = test_df.merge(preds, on=["seller_id", "day"], how="left")

        cross = ((preds.pred_p10_raw > preds.pred_p50_raw) | (preds.pred_p50_raw > preds.pred_p90_raw)).sum()
        p10, p50, p90 = rearrange_quantiles(
            test_df.pred_p10_raw.to_numpy(), test_df.pred_p50_raw.to_numpy(), test_df.pred_p90_raw.to_numpy()
        )
        test_df["pred_p10"], test_df["pred_p50"], test_df["pred_p90"] = p10, p50, p90

        actual = test_df[TARGET].to_numpy()
        m = {"fold": fold["name"], "Quantile_Crossings": int(cross)}
        for name, col in [("Naive", "pred_naive"), ("SNaive", "pred_snaive"), ("MA", "pred_ma"), ("LGBM_P50", "pred_p50")]:
            pred = test_df[col].to_numpy()
            m[f"{name}_MAE"] = mae(actual, pred)
            m[f"{name}_RMSE"] = rmse(actual, pred)
            m[f"{name}_SMAPE"] = smape(actual, pred)
            m[f"{name}_WAPE"] = wape(actual, pred)
        # Coverage is uninformative on intermittent demand: when a series is
        # >90% zeros the true P10 and P90 are both 0, so those rows are covered
        # for free. Report overall, active-series, and the zero share together.
        active_ids = train_wide.index[train_wide.mean(axis=1) >= ACTIVE_MIN_DAILY]
        act_mask = test_df["seller_id"].isin(active_ids).to_numpy()
        m["LGBM_Coverage"] = coverage(actual, p10, p90)
        m["LGBM_Coverage_Active"] = (
            coverage(actual[act_mask], p10[act_mask], p90[act_mask]) if act_mask.any() else float("nan")
        )
        m["Active_Series_Share"] = float(act_mask.mean())
        m["Zero_Actual_Share"] = float((actual == 0).mean())
        m["Degenerate_Interval_Share"] = float(((p90 - p10) < 1e-9).mean())
        m["LGBM_Width"] = float((p90 - p10).mean())
        m["Pinball_P10"] = pinball_loss(actual, p10, 0.10)
        m["Pinball_P90"] = pinball_loss(actual, p90, 0.90)
        all_metrics.append(m)
        print(f"  WAPE  naive={m['Naive_WAPE']:.3f}  snaive={m['SNaive_WAPE']:.3f}  "
              f"ma={m['MA_WAPE']:.3f}  lgbm={m['LGBM_P50_WAPE']:.3f}")
        print(f"  coverage overall={m['LGBM_Coverage']:.1%}  active={m['LGBM_Coverage_Active']:.1%}  "
              f"(nominal 80%)  zero-actuals={m['Zero_Actual_Share']:.1%}  "
              f"degenerate-intervals={m['Degenerate_Interval_Share']:.1%}  crossings={cross}")

        if fold["name"] == "holdout":
            final_forecasts = test_df[["seller_id", "day", TARGET, "pred_naive", "pred_snaive",
                                       "pred_ma", "pred_p10", "pred_p50", "pred_p90"]].copy()
            os.makedirs(os.path.join(OUT_DIR, "models"), exist_ok=True)
            for q, mdl in models.items():
                joblib.dump(mdl, os.path.join(OUT_DIR, "models", f"lgbm_{q}.joblib"))
            ranges = {c: [float(train_df[c].min()), float(train_df[c].max())] for c in FEATURE_COLS}
            with open(os.path.join(OUT_DIR, "models", "training_ranges.json"), "w") as f:
                json.dump({"feature_cols": FEATURE_COLS, "ranges": ranges}, f, indent=2)

            sample = test_df[FEATURE_COLS].sample(min(2000, len(test_df)), random_state=7)
            shap_values = shap.TreeExplainer(models["p50"]).shap_values(sample)
            imp = pd.DataFrame({"feature": FEATURE_COLS,
                                "mean_abs_shap": np.abs(shap_values).mean(axis=0)})
            imp.sort_values("mean_abs_shap", ascending=False).to_csv(
                os.path.join(OUT_DIR, "shap_importance.csv"), index=False)

    metrics_df = pd.DataFrame(all_metrics)
    print("\n=== Summary ===")
    print(metrics_df.to_string())
    os.makedirs(OUT_DIR, exist_ok=True)
    final_forecasts.to_csv(os.path.join(OUT_DIR, "final_forecasts.csv"), index=False)
    metrics_df.to_csv(os.path.join(OUT_DIR, "backtest_metrics.csv"), index=False)
    return metrics_df


if __name__ == "__main__":
    run_pipeline()
