"""
End-to-End Aerospace Supply Chain Forecasting Pipeline.

Executes:
1. DuckDB data ingestion & quality validations
2. Leakage-free feature engineering
3. Baseline forecasting (Naive, Seasonal Naive, Moving Average)
4. LightGBM Quantile models (P10, P50, P90)
5. 3 x 14-day time-based backtesting folds
6. Quantile coverage & crossing evaluations (with rearrangement)
7. SHAP interpretability (global feature importance & sample explanations)
8. Final out-of-sample forecast generation -> forecast.csv
"""
from __future__ import annotations

import json
import os
from typing import Any, Dict, List, Tuple
import duckdb
import joblib
import lightgbm as lgb
import numpy as np
import pandas as pd
import shap

from src.data.aerospace_loader import (
    load_aerospace_to_duckdb,
    run_data_quality_checks,
    AEROSPACE_DATA_DIR,
    AEROSPACE_DB_PATH,
)
from src.data.aerospace_features import (
    extract_base_dataset,
    engineer_features,
    TARGET_COL,
)
from src.forecast.metrics import (
    mae,
    rmse,
    smape,
    wape,
    coverage,
    rearrange_quantiles,
    pinball_loss,
)
from src.forecast.baselines import (
    naive_forecast,
    seasonal_naive_forecast,
    moving_average_forecast,
)

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
PROCESSED_DIR = os.path.join(REPO_ROOT, "data", "processed")
MODELS_DIR = os.path.join(PROCESSED_DIR, "models_aerospace")

# 3 x 14-day (2-week) backtesting folds
# Weekly frequency (7 days per step): 14 days = 2 weeks
FOLDS = [
    {
        "name": "fold_1",
        "train_end": "2024-11-11",
        "test_start": "2024-11-18",
        "test_end": "2024-11-25",
    },
    {
        "name": "fold_2",
        "train_end": "2024-11-25",
        "test_start": "2024-12-02",
        "test_end": "2024-12-09",
    },
    {
        "name": "fold_3",
        "train_end": "2024-12-09",
        "test_start": "2024-12-16",
        "test_end": "2024-12-23",
    },
]


def train_lgbm_quantiles(
    train_df: pd.DataFrame, feature_cols: List[str], target_col: str = TARGET_COL
) -> Dict[str, lgb.LGBMRegressor]:
    """Train separate LightGBM quantile regression models for P10, P50, and P90."""
    X = train_df[feature_cols]
    y = train_df[target_col]

    models = {}
    params = {
        "p10": {"alpha": 0.10, "n_estimators": 250, "learning_rate": 0.05, "num_leaves": 31, "random_state": 42},
        "p50": {"alpha": 0.50, "n_estimators": 250, "learning_rate": 0.05, "num_leaves": 31, "random_state": 42},
        "p90": {"alpha": 0.90, "n_estimators": 250, "learning_rate": 0.05, "num_leaves": 31, "random_state": 42},
    }

    for q_name, q_param in params.items():
        model = lgb.LGBMRegressor(
            objective="quantile",
            alpha=q_param["alpha"],
            n_estimators=q_param["n_estimators"],
            learning_rate=q_param["learning_rate"],
            num_leaves=q_param["num_leaves"],
            random_state=q_param["random_state"],
            verbosity=-1,
            n_jobs=-1,
        )
        model.fit(X, y)
        models[q_name] = model

    return models


def evaluate_backtest_folds(
    df: pd.DataFrame, feature_cols: List[str]
) -> Tuple[pd.DataFrame, pd.DataFrame, Dict[str, Any]]:
    """Execute time-based backtesting across the 3 x 14-day folds."""
    metrics_records = []
    all_fold_preds = []

    for fold in FOLDS:
        train_end = pd.Timestamp(fold["train_end"])
        test_start = pd.Timestamp(fold["test_start"])
        test_end = pd.Timestamp(fold["test_end"])

        train_df = df[df["date"] <= train_end].copy()
        test_df = df[(df["date"] >= test_start) & (df["date"] <= test_end)].copy()

        if test_df.empty:
            continue

        print(f"\n--- Running {fold['name']} (Train <= {train_end.date()} | Test: {test_start.date()} to {test_end.date()}) ---")

        # 1. Compute Baselines per series
        # Build wide pivot of past history for baseline calculation
        train_pivot = train_df.pivot_table(index="series_id", columns="date", values=TARGET_COL, fill_value=0.0)
        
        test_df = test_df.sort_values(["series_id", "date"]).reset_index(drop=True)
        naive_preds, snaive_preds, ma_preds = [], [], []

        for _, row in test_df.iterrows():
            sid = row["series_id"]
            hist_series = train_pivot.loc[sid] if sid in train_pivot.index else pd.Series([0.0])
            # Determine step index within horizon (1 or 2)
            horizon_step = int((row["date"] - train_end).days // 7)
            naive_preds.append(naive_forecast(hist_series, horizon=horizon_step))
            snaive_preds.append(seasonal_naive_forecast(hist_series, horizon=horizon_step, season_length=4))
            ma_preds.append(moving_average_forecast(hist_series, horizon=horizon_step, window=4))

        test_df["pred_naive"] = naive_preds
        test_df["pred_snaive"] = snaive_preds
        test_df["pred_ma"] = ma_preds

        # 2. Train LightGBM Quantile models
        models = train_lgbm_quantiles(train_df, feature_cols, TARGET_COL)

        # 3. Predict Quantiles
        X_test = test_df[feature_cols]
        raw_p10 = models["p10"].predict(X_test)
        raw_p50 = models["p50"].predict(X_test)
        raw_p90 = models["p90"].predict(X_test)

        test_df["pred_p10_raw"] = raw_p10
        test_df["pred_p50_raw"] = raw_p50
        test_df["pred_p90_raw"] = raw_p90

        # Quantile crossings check before rearrangement
        crossings = ((raw_p10 > raw_p50) | (raw_p50 > raw_p90)).sum()
        crossing_freq = crossings / len(test_df)

        # Monotone Rearrangement to strictly guarantee P10 <= P50 <= P90
        p10_clean, p50_clean, p90_clean = rearrange_quantiles(raw_p10, raw_p50, raw_p90)
        test_df["pred_p10"] = p10_clean
        test_df["pred_p50"] = p50_clean
        test_df["pred_p90"] = p90_clean

        test_df["fold"] = fold["name"]
        all_fold_preds.append(test_df)

        actuals = test_df[TARGET_COL].to_numpy()

        # Calculate metrics
        m = {
            "fold": fold["name"],
            "test_rows": len(test_df),
            "crossing_count": int(crossings),
            "crossing_pct": float(crossing_freq * 100),
            # LightGBM P50
            "LGBM_P50_MAE": mae(actuals, p50_clean),
            "LGBM_P50_RMSE": rmse(actuals, p50_clean),
            "LGBM_P50_SMAPE": smape(actuals, p50_clean),
            "LGBM_P50_WAPE": wape(actuals, p50_clean),
            # Baselines
            "Naive_MAE": mae(actuals, test_df["pred_naive"].to_numpy()),
            "Naive_RMSE": rmse(actuals, test_df["pred_naive"].to_numpy()),
            "Naive_SMAPE": smape(actuals, test_df["pred_naive"].to_numpy()),
            "Naive_WAPE": wape(actuals, test_df["pred_naive"].to_numpy()),
            "MA_MAE": mae(actuals, test_df["pred_ma"].to_numpy()),
            "MA_RMSE": rmse(actuals, test_df["pred_ma"].to_numpy()),
            "MA_SMAPE": smape(actuals, test_df["pred_ma"].to_numpy()),
            "MA_WAPE": wape(actuals, test_df["pred_ma"].to_numpy()),
            "SNaive_MAE": mae(actuals, test_df["pred_snaive"].to_numpy()),
            "SNaive_RMSE": rmse(actuals, test_df["pred_snaive"].to_numpy()),
            "SNaive_SMAPE": smape(actuals, test_df["pred_snaive"].to_numpy()),
            "SNaive_WAPE": wape(actuals, test_df["pred_snaive"].to_numpy()),
            # Quantile Coverage
            "P10_Coverage": float((actuals <= p10_clean).mean()),
            "P90_Coverage": float((actuals <= p90_clean).mean()),
            "Interval_Coverage_80": coverage(actuals, p10_clean, p90_clean),
            "Mean_Interval_Width": float((p90_clean - p10_clean).mean()),
            "Pinball_Loss_P10": pinball_loss(actuals, p10_clean, 0.10),
            "Pinball_Loss_P50": pinball_loss(actuals, p50_clean, 0.50),
            "Pinball_Loss_P90": pinball_loss(actuals, p90_clean, 0.90),
        }
        metrics_records.append(m)
        print(f"  Results for {fold['name']}:")
        print(f"    LGBM P50 MAE: {m['LGBM_P50_MAE']:.3f} | RMSE: {m['LGBM_P50_RMSE']:.3f} | sMAPE: {m['LGBM_P50_SMAPE']:.3f} | WAPE: {m['LGBM_P50_WAPE']:.3f}")
        print(f"    Naive    MAE: {m['Naive_MAE']:.3f} | RMSE: {m['Naive_RMSE']:.3f} | sMAPE: {m['Naive_SMAPE']:.3f} | WAPE: {m['Naive_WAPE']:.3f}")
        print(f"    MA       MAE: {m['MA_MAE']:.3f} | RMSE: {m['MA_RMSE']:.3f} | sMAPE: {m['MA_SMAPE']:.3f} | WAPE: {m['MA_WAPE']:.3f}")
        print(f"    SNaive   MAE: {m['SNaive_MAE']:.3f} | RMSE: {m['SNaive_RMSE']:.3f} | sMAPE: {m['SNaive_SMAPE']:.3f} | WAPE: {m['SNaive_WAPE']:.3f}")
        print(f"    80% Prediction Interval Coverage: {m['Interval_Coverage_80']*100:.1f}% (P10 Cov: {m['P10_Coverage']*100:.1f}%, P90 Cov: {m['P90_Coverage']*100:.1f}%)")

    metrics_df = pd.DataFrame(metrics_records)
    all_preds_df = pd.concat(all_fold_preds, ignore_index=True)
    return metrics_df, all_preds_df, models


def run_shap_analysis(
    model: lgb.LGBMRegressor, df_sample: pd.DataFrame, feature_cols: List[str]
) -> Tuple[pd.DataFrame, Any]:
    """Calculate SHAP feature importance and explanation values."""
    print("\n--- Computing SHAP Values for Model Interpretability ---")
    X_sample = df_sample[feature_cols].sample(min(3000, len(df_sample)), random_state=42)
    explainer = shap.TreeExplainer(model)
    shap_vals = explainer.shap_values(X_sample)

    mean_abs_shap = np.abs(shap_vals).mean(axis=0)
    shap_importance = pd.DataFrame({
        "feature": feature_cols,
        "mean_abs_shap": mean_abs_shap,
    }).sort_values("mean_abs_shap", ascending=False).reset_index(drop=True)

    print("\nTop 10 Global SHAP Feature Importances:")
    for idx, r in shap_importance.head(10).iterrows():
        print(f"  {idx+1:2d}. {r['feature']:<25} : {r['mean_abs_shap']:.4f}")

    return shap_importance, shap_vals


def generate_final_forecast(
    df: pd.DataFrame, feature_cols: List[str]
) -> Tuple[pd.DataFrame, Dict[str, lgb.LGBMRegressor]]:
    """Train on full historical dataset and produce 14-day out-of-sample forecast.csv."""
    print("\n--- Training Final Models on Full History & Generating forecast.csv ---")
    models = train_lgbm_quantiles(df, feature_cols, TARGET_COL)

    # Save models
    os.makedirs(MODELS_DIR, exist_ok=True)
    for q_name, mdl in models.items():
        joblib.dump(mdl, os.path.join(MODELS_DIR, f"lgbm_{q_name}.joblib"))

    # Construct next 2-week forecast horizons (14 days: +7d, +14d)
    last_date = df["date"].max()
    horizon_dates = [last_date + pd.Timedelta(days=7), last_date + pd.Timedelta(days=14)]

    # Get latest state per series
    latest_rows = df[df["date"] == last_date].copy()
    
    forecast_rows = []
    # Step 1: +7 days
    d1 = horizon_dates[0]
    step1_df = latest_rows.copy()
    step1_df["date"] = d1
    step1_df["month"] = d1.month
    step1_df["week_of_year"] = int(d1.isocalendar().week)
    step1_df["quarter"] = d1.quarter
    step1_df["day_of_month"] = d1.day
    step1_df["day_of_week"] = d1.dayofweek
    # Lags for step 1
    step1_df["lag_1"] = latest_rows[TARGET_COL].to_numpy()
    step1_df["lag_2"] = latest_rows["lag_1"].to_numpy()
    step1_df["lag_4"] = latest_rows["lag_3"] if "lag_3" in latest_rows else latest_rows["lag_4"].to_numpy()
    
    p10_1 = models["p10"].predict(step1_df[feature_cols])
    p50_1 = models["p50"].predict(step1_df[feature_cols])
    p90_1 = models["p90"].predict(step1_df[feature_cols])
    p10_1, p50_1, p90_1 = rearrange_quantiles(p10_1, p50_1, p90_1)

    step1_df["P10"] = p10_1
    step1_df["P50"] = p50_1
    step1_df["P90"] = p90_1
    step1_df["forecast_date"] = d1.strftime("%Y-%m-%d")
    forecast_rows.append(step1_df[["part_id", "site_id", "forecast_date", "P10", "P50", "P90"]])

    # Step 2: +14 days (recursive feeding P50 into lag_1)
    d2 = horizon_dates[1]
    step2_df = latest_rows.copy()
    step2_df["date"] = d2
    step2_df["month"] = d2.month
    step2_df["week_of_year"] = int(d2.isocalendar().week)
    step2_df["quarter"] = d2.quarter
    step2_df["day_of_month"] = d2.day
    step2_df["day_of_week"] = d2.dayofweek
    # Lags for step 2: lag_1 is predicted P50 from step 1
    step2_df["lag_1"] = p50_1
    step2_df["lag_2"] = latest_rows[TARGET_COL].to_numpy()

    p10_2 = models["p10"].predict(step2_df[feature_cols])
    p50_2 = models["p50"].predict(step2_df[feature_cols])
    p90_2 = models["p90"].predict(step2_df[feature_cols])
    p10_2, p50_2, p90_2 = rearrange_quantiles(p10_2, p50_2, p90_2)

    step2_df["P10"] = p10_2
    step2_df["P50"] = p50_2
    step2_df["P90"] = p90_2
    step2_df["forecast_date"] = d2.strftime("%Y-%m-%d")
    forecast_rows.append(step2_df[["part_id", "site_id", "forecast_date", "P10", "P50", "P90"]])

    forecast_df = pd.concat(forecast_rows, ignore_index=True)
    forecast_df = forecast_df.sort_values(["part_id", "site_id", "forecast_date"]).reset_index(drop=True)

    # Save to both project root and data/
    root_forecast_path = os.path.join(REPO_ROOT, "forecast.csv")
    data_forecast_path = os.path.join(PROCESSED_DIR, "forecast.csv")
    os.makedirs(PROCESSED_DIR, exist_ok=True)
    forecast_df.to_csv(root_forecast_path, index=False)
    forecast_df.to_csv(data_forecast_path, index=False)
    print(f"Saved forecast.csv to {root_forecast_path} ({len(forecast_df)} rows)")

    return forecast_df, models


def run_aerospace_pipeline() -> Dict[str, Any]:
    """Execute complete end-to-end aerospace forecasting pipeline."""
    print("=" * 60)
    print("STARTING AEROSPACE SUPPLY CHAIN FORECASTING PIPELINE")
    print("=" * 60)

    # 1. Load to DuckDB
    con, table_counts = load_aerospace_to_duckdb()
    print(f"Loaded DuckDB tables: {table_counts}")

    # 2. Data Quality Checks
    dq_report = run_data_quality_checks(con)
    print(f"Data Quality Status: {dq_report['status']}")

    # 3. Base Dataset Extraction
    base_df = extract_base_dataset(con)
    con.close()
    print(f"Extracted base dataset with {len(base_df):,} rows and {base_df['series_id'].nunique()} series.")

    # 4. Feature Engineering
    featured_df, feature_cols = engineer_features(base_df)
    print(f"Generated {len(feature_cols)} features: {feature_cols}")

    # Save features to parquet
    os.makedirs(PROCESSED_DIR, exist_ok=True)
    feat_parquet_path = os.path.join(PROCESSED_DIR, "aerospace_features.parquet")
    featured_df.to_parquet(feat_parquet_path, index=False)

    # 5. Backtesting (3 x 14-day folds)
    metrics_df, fold_preds, fold_models = evaluate_backtest_folds(featured_df, feature_cols)

    # 6. SHAP Interpretability
    shap_importance, _ = run_shap_analysis(fold_models["p50"], featured_df, feature_cols)
    shap_csv_path = os.path.join(PROCESSED_DIR, "aerospace_shap_importance.csv")
    shap_importance.to_csv(shap_csv_path, index=False)

    # 7. Final Forecast Generation
    forecast_df, final_models = generate_final_forecast(featured_df, feature_cols)

    # Save metrics
    metrics_csv_path = os.path.join(PROCESSED_DIR, "aerospace_backtest_metrics.csv")
    metrics_df.to_csv(metrics_csv_path, index=False)

    print("\n" + "=" * 60)
    print("AEROSPACE FORECASTING PIPELINE COMPLETED SUCCESSFULLY")
    print("=" * 60)

    return {
        "table_counts": table_counts,
        "dq_report": dq_report,
        "features": feature_cols,
        "metrics_df": metrics_df,
        "shap_importance": shap_importance,
        "forecast_df": forecast_df,
    }


if __name__ == "__main__":
    run_aerospace_pipeline()
