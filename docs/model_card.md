# Model Card: StockPilot Quantile Forecasting

## 1. Overview
A multi-horizon **LightGBM quantile regressor** predicting a demand distribution (P10, P50, P90)
per seller-day over a 14-day horizon. The quantiles feed a Monte-Carlo of demand over the
protection interval (lead time + review period), which sets the order-up-to level. The point of
the model is the *distribution*, not the point forecast.

## 2. Architecture
- **Algorithm**: LightGBM (gradient-boosted trees), quantile (pinball) objective.
- **Instances**: three models at alpha = **0.10 / 0.50 / 0.90**, giving a nominal 80% interval.
- **Prediction**: direct recursive multi-step. Lag and rolling features inside the forecast window
  are rebuilt from the model's own earlier predictions, never from test-window actuals.
- **Crossing**: enforced non-crossing by post-hoc rearrangement (row-wise sort), then clipped at 0.
  Crossings on the holdout before correction: **5** rows.

## 3. Features
23 features from `src/data/features.py`, built by a function that physically truncates the panel at
the forecast origin: lags 1/7/14/28, rolling mean and std over 7/28 days, calendar flags
(day-of-week, weekend, month, holiday), price, freight, price/freight ratio, and per-seller
lead-time statistics (mean, std, p50, p90, n). Monotone constraints: +1 on discount, -1 on price.

## 4. Performance (14-day out-of-time holdout, 2018-08-14 to 2018-08-27)
- **WAPE 0.303** vs moving average 1.712 and seasonal-naive 1.830
  -> an **82.3% error reduction** against the moving-average baseline on this fold.
- Averaged across all four backtest folds the reduction is **75.5%**. That 4-fold mean is
  the figure used by `/api/kpis` and the deck; the holdout-only figure above is higher. Quote one or
  the other consistently and say which it is.
- **Pinball loss**: P10 0.0021, P90 0.0086. This is the primary calibration
  metric for this model; see the caveat below for why interval coverage is not.

## 5. Interval coverage: why the headline number is misleading
Measured coverage of the P10-P90 band on the holdout is **99.5%** against a nominal 80%,
and **98.2%** restricted to active sellers (training mean >= 0.10 items/day). Both look
like severe over-coverage. They are not a calibration failure, and narrowing the quantiles does not
fix them:

- **95.1% of holdout rows have zero actual demand.** For a series that is zero on more
  than 90% of days, the true 10th, 50th and 90th percentiles are all genuinely 0. A correct model
  must output a degenerate interval there.
- **95.1% of predicted intervals are degenerate** (P10 = P90 = 0) — matching the zero
  share almost exactly. On those rows an actual of 0 falls inside [0, 0] and is "covered" for free.
- Coverage is therefore dominated by trivially-covered zeros and carries almost no information about
  the sharpness of the distribution where demand actually occurs.

An earlier revision of this card reported ~80% coverage after changing the alphas to 0.25/0.75.
That change was reverted. It did not improve calibration — it relabelled the 25th and 75th
percentiles as "P10" and "P90", which broke the downstream service-level assumption in
`scripts/run_plan.py` (which samples the quantiles as if they were the 10th and 90th), and the
~80% figure it produced was coverage conditioned on actual > 0, which is selection on the outcome
and not comparable to an 80% nominal.

**What we report instead**: pinball loss as the calibration metric, plus the zero-actual and
degenerate-interval shares alongside any coverage figure so the reader can interpret it.

## 6. Limitations
- **No promotion or weather data.** Olist has neither, so `discount` is inferred from price
  variation only. The monotone constraints keep the What-If response directionally sane, but the
  promotion and discount sliders are an extrapolation, not a fitted effect.
- **Extreme intermittency.** 93-96% of seller-days are zero. The model is meaningful for the
  high-velocity sellers used in the plan and degenerates to a point mass at zero on the long tail.
- **Short evaluation window.** Olist activity ends 2018-08-27; the panel is truncated there and
  each fold is 14 days. No annual seasonality is observable.
- **Marketplace, not replenishment, data.** There is no purchase-order history, so the simulator's
  Arm A is a naive status-quo rule, not a replay of real ordering decisions.

## 7. Guardrails
The model's output is never executed directly. Order quantities pass through order-value and budget
caps, a confidence threshold and an evidence check; anything flagged is escalated to a human. The
LLM explainer writes narrative only — every number in a recommendation comes from deterministic code.
