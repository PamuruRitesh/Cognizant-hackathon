#!/usr/bin/env python
"""
Executable script for running the Aerospace Supply Chain Forecasting Pipeline.
"""
import sys
import os

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

from src.forecast.aerospace_pipeline import run_aerospace_pipeline

if __name__ == "__main__":
    results = run_aerospace_pipeline()
    print("\nPipeline execution summary:")
    print("Metrics:")
    print(results["metrics_df"][["fold", "LGBM_P50_MAE", "LGBM_P50_RMSE", "LGBM_P50_SMAPE", "Interval_Coverage_80", "crossing_count"]].to_string())
    print("\nForecast.csv head:")
    print(results["forecast_df"].head(10).to_string())
