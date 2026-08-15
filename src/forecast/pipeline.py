"""
End-to-end forecasting pipeline that trains quantile LightGBM models,
evaluates baselines per seller, tracks backtest metrics across folds,
and generates final holdout predictions.
"""
from __future__ import annotations

import os
import time
import numpy as np
import pandas as pd
import shap

from src.forecast.baselines import naive_forecast, seasonal_naive_forecast, moving_average_forecast
from src.forecast.lgbm_quantile import train_quantile_models, predict_quantiles
from src.forecast.metrics import mae, rmse, smape, coverage, rearrange_quantiles, pinball_loss

# Folds: 3 folds of 14 days, plus a final 14-day holdout.
# Folds are defined by their offset from the very last day in the dataset.
FOLDS = [
    {"name": "fold_1", "train_end": 56, "test_start": 55, "test_end": 42},
    {"name": "fold_2", "train_end": 42, "test_start": 41, "test_end": 28},
    {"name": "fold_3", "train_end": 28, "test_start": 27, "test_end": 14},
    {"name": "holdout", "train_end": 14, "test_start": 13, "test_end": 0},
]

FEATURE_COLS = [
    "avg_price", "avg_freight",
    "lag_1", "lag_7", "lag_14", "lag_28",
    "roll_mean_7", "roll_std_7", "roll_mean_28", "roll_std_28",
    "day_of_week", "is_weekend", "month", "is_holiday",
    "price_over_freight_ratio",
    "lt_mean", "lt_std", "lt_p50", "lt_p90", "lt_n"
]

TARGET = "n_items"

def run_pipeline(data_path: str = "data/processed/features.parquet"):
    print(f"Loading data from {data_path}...")
    df = pd.read_parquet(data_path)
    df['day'] = pd.to_datetime(df['day'])
    
    fcols = df.select_dtypes('float').columns
    icols = df.select_dtypes('integer').columns
    df[fcols] = df[fcols].apply(pd.to_numeric, downcast='float')
    df[icols] = df[icols].apply(pd.to_numeric, downcast='integer')
    
    max_date = df['day'].max()
    print(f"Max date in dataset: {max_date}")
    
    # Fill missing values for features (e.g. roll_std, price)
    for col in FEATURE_COLS:
        if df[col].isnull().any():
            df[col] = df[col].fillna(0)
            
    all_metrics = []
    final_forecasts = []
    
    for fold in FOLDS:
        print(f"\n--- Running {fold['name']} ---")
        
        train_end_date = max_date - pd.Timedelta(days=fold["train_end"])
        test_start_date = max_date - pd.Timedelta(days=fold["test_start"])
        test_end_date = max_date - pd.Timedelta(days=fold["test_end"])
        
        print(f"Train ends on: {train_end_date}")
        print(f"Test window: {test_start_date} to {test_end_date}")
        
        train_df = df[df['day'] <= train_end_date].copy()
        test_df = df[(df['day'] >= test_start_date) & (df['day'] <= test_end_date)].copy()
        
        if test_df.empty:
            print("Warning: Test dataframe is empty.")
            continue
            
        print(f"Train size: {len(train_df)}, Test size: {len(test_df)}")
        
        # 1. Evaluate baselines per seller
        print("Evaluating baselines...")
        test_df['pred_naive'] = np.nan
        test_df['pred_snaive'] = np.nan
        test_df['pred_ma'] = np.nan
        
        # We need historical data for each seller in test set to run baselines
        for seller_id, group in test_df.groupby('seller_id'):
            # Get train history for this seller
            history = train_df[train_df['seller_id'] == seller_id].sort_values('day')[TARGET]
            if len(history) == 0:
                # No history, baselines predict 0
                test_df.loc[group.index, 'pred_naive'] = 0.0
                test_df.loc[group.index, 'pred_snaive'] = 0.0
                test_df.loc[group.index, 'pred_ma'] = 0.0
                continue
                
            # Iterate through the test window for 1-step or multi-step.
            # The instructions imply standard evaluation. We will use the history + 
            # true lags if doing 1-step, but usually baselines for 14-days are multi-step.
            # To simplify, since baselines in baselines.py take horizon:
            # wait, baselines.py functions take `series` and `horizon`.
            # Let's just predict the whole 14 days based on the end of train.
            
            # Predict for each step in the horizon (1 to len(group))
            preds_naive = []
            preds_snaive = []
            preds_ma = []
            for i in range(1, len(group) + 1):
                preds_naive.append(naive_forecast(history, horizon=i))
                preds_snaive.append(seasonal_naive_forecast(history, horizon=i, season_length=7))
                preds_ma.append(moving_average_forecast(history, horizon=i, window=28))
                
            test_df.loc[group.index, 'pred_naive'] = preds_naive
            test_df.loc[group.index, 'pred_snaive'] = preds_snaive
            test_df.loc[group.index, 'pred_ma'] = preds_ma
            
        # 2. Train LGBM
        print("Training LightGBM models (P10, P50, P90)...")
        models = train_quantile_models(train_df, FEATURE_COLS, TARGET)
        
        # 3. Predict LGBM
        # We use predict_quantiles which does rearrangement automatically.
        # But instructions say: "First measure quantile crossing frequency. If crossing occurs, apply a clearly documented post-processing correction such as rearrangement/sorting and report the number of affected predictions."
        # Let's bypass predict_quantiles so we can measure first.
        p10 = models["p10"].predict(test_df[FEATURE_COLS])
        p50 = models["p50"].predict(test_df[FEATURE_COLS])
        p90 = models["p90"].predict(test_df[FEATURE_COLS])
        
        # Check crossings
        cross_mask = (p10 > p50) | (p50 > p90) | (p10 > p90)
        cross_count = cross_mask.sum()
        print(f"Quantile crossing frequency before correction: {cross_count} / {len(test_df)} ({cross_count/len(test_df):.2%})")
        
        # Apply rearrangement
        p10_fixed, p50_fixed, p90_fixed = rearrange_quantiles(p10, p50, p90)
        
        test_df['pred_p10'] = p10_fixed
        test_df['pred_p50'] = p50_fixed
        test_df['pred_p90'] = p90_fixed
        
        # 4. Metrics
        actual = test_df[TARGET].values
        
        fold_metrics = {"fold": fold["name"]}
        
        for model_name, pred_col in [("Naive", "pred_naive"), ("SNaive", "pred_snaive"), ("MA", "pred_ma"), ("LGBM_P50", "pred_p50")]:
            pred = test_df[pred_col].values
            fold_metrics[f"{model_name}_MAE"] = mae(actual, pred)
            fold_metrics[f"{model_name}_RMSE"] = rmse(actual, pred)
            fold_metrics[f"{model_name}_SMAPE"] = smape(actual, pred)
            
        # Quantile metrics
        emp_coverage = coverage(actual, test_df['pred_p10'].values, test_df['pred_p90'].values)
        avg_width = (test_df['pred_p90'] - test_df['pred_p10']).mean()
        
        fold_metrics["LGBM_Coverage"] = emp_coverage
        fold_metrics["LGBM_Width"] = avg_width
        fold_metrics["Quantile_Crossings"] = cross_count
        
        print(f"Results for {fold['name']}:")
        print(f"  LGBM P50 MAE: {fold_metrics['LGBM_P50_MAE']:.4f}")
        print(f"  LGBM P50 SMAPE: {fold_metrics['LGBM_P50_SMAPE']:.4f}")
        print(f"  LGBM Coverage (P10-P90): {emp_coverage:.2%}")
        
        all_metrics.append(fold_metrics)
        
        if fold["name"] == "holdout":
            final_forecasts = test_df[['seller_id', 'day', 'n_items', 'pred_naive', 'pred_snaive', 'pred_ma', 'pred_p10', 'pred_p50', 'pred_p90']].copy()
            
            # 5. SHAP
            print("\nCalculating SHAP values for holdout using P50 model...")
            explainer = shap.TreeExplainer(models["p50"])
            # Sample for speed if needed, but holdout is small (~14 days * 3000 sellers = 42k rows)
            shap_sample = test_df[FEATURE_COLS]
            shap_values = explainer.shap_values(shap_sample)
            print("SHAP values calculated successfully.")
            # Note: Dataset used is the final holdout test set

    metrics_df = pd.DataFrame(all_metrics)
    print("\n=== Summary Metrics ===")
    print(metrics_df.to_string())
    
    os.makedirs("data/processed", exist_ok=True)
    final_forecasts.to_csv("data/processed/final_forecasts.csv", index=False)
    print("Final holdout forecasts saved to data/processed/final_forecasts.csv")
    metrics_df.to_csv("data/processed/backtest_metrics.csv", index=False)
    
if __name__ == "__main__":
    run_pipeline()
