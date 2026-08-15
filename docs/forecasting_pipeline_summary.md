# Forecasting Pipeline Implementation Summary

## Overview
This document summarizes the end-to-end time series forecasting pipeline implemented for the StockPilot project (Olist Dataset). The objective was to create a robust, per-seller demand forecasting pipeline utilizing quantile regression with LightGBM, rigorous backtesting, and model explainability via SHAP.

All implemented logic is isolated strictly on a **per `seller_id`** basis to prevent data leakage and cross-contamination between sellers.

## 1. Data Processing & Backtesting Strategy
- **Data Range & Integrity**: The dataset (`features.parquet`) contains continuous daily records across 769 days (2016-09-04 to 2018-10-12) for 3,095 sellers.
- **Fold Design**: Given the robust historical density, we adopted a chronological backtesting strategy consisting of:
  - **3 Backtesting Folds**: Each fold covers a 14-day test window rolling backward from the holdout.
  - **Holdout Period**: A final, untouched 14-day chronological holdout period at the very end of the time series. This period is strictly reserved for generating the final forecasts and SHAP values, completely shielded from model tuning.
- **Data Leakage Check**: Confirmed that all temporal features (lags and rolling averages in `src/data/features.py`) correctly utilize `shift()` prior to aggregation, mathematically guaranteeing zero future-target leakage.

## 2. Modeling Approach
### LightGBM Quantile Regression
- We train three separate LightGBM regressors targeting the 10th (P10), 50th (P50), and 90th (P90) percentiles using `alpha` values of 0.1, 0.5, and 0.9 respectively.
- **Monotone Constraints**: Removed LightGBM `monotone_constraints` as it is fundamentally incompatible with the quantile objective in the scikit-learn API (fatal API error).
- **Quantile Crossing Correction**: We track quantile crossings (e.g., P10 > P50) natively. The frequency of crossings prior to correction was actively logged (0.01% in Fold 1, 0% thereafter). We then apply a deterministic `rearrange_quantiles` post-processing step (row-wise sorting) to restore strict monotonically increasing quantile bounds.

### Baselines
To benchmark the LightGBM models, three simple baselines were evaluated for each seller:
1. **Naive Forecast**: Repeats the last observed value.
2. **Seasonal Naive**: Repeats the value from 7 days prior (lag 7).
3. **Moving Average**: A 28-day trailing average.

## 3. Evaluation Metrics
We introduced three standard point-forecast metrics and two interval-forecast metrics implemented in `src/forecast/metrics.py`:
- **MAE** (Mean Absolute Error)
- **RMSE** (Root Mean Squared Error)
- **SMAPE** (Symmetric Mean Absolute Percentage Error): Modified to strictly handle division-by-zero occurrences (yielding 0 error when both prediction and actuals are identically 0).
- **Empirical Coverage**: Percentage of actual observations falling cleanly within the predicted P10-P90 interval (Targeting ~80% coverage).
- **Interval Width**: The average spread between the P90 and P10 bounds to measure confidence tightness.

## 4. SHAP Explainability
- SHAP values are extracted specifically on the **final untouched holdout dataset** using a `TreeExplainer` applied to the P50 model. This ensures feature importance is explained purely on unseen test-distribution data rather than overfitted training data.

## 5. Artifacts and Outputs
The integrated pipeline (`src/forecast/pipeline.py`) performs data splitting, baseline training, LightGBM training, metric evaluation, SHAP calculation, and final serialization in a single command. 

- **Execution Command**: `make train` (wired seamlessly to the pipeline).
- **Memory Profiling**: Added dynamic memory downcasting directly into the pipeline to securely process over 1,000,000 observations across memory-constrained limits without throwing `ArrayMemoryError` exceptions.

**Generated Files:**
1. `data/processed/final_forecasts.csv`: Contains the complete set of predictions (Baselines + Quantiles) for the final holdout period.
2. `data/processed/backtest_metrics.csv`: Tabular logging of all performance metrics across all 3 folds and the holdout.
