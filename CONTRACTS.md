# CONTRACTS.md — the source of truth

Treat any change to this file as requiring all-team agreement. Written Day 1, hour 2.

## 1. Data contract — `forecasts.parquet`

| column | type | note |
|---|---|---|
| date | date | forecast date |
| store_id | str | |
| product_id | str | |
| horizon | int | days ahead (1–14) |
| p10, p50, p90 | float | ≥0; p10≤p50≤p90 enforced by post-hoc rearrangement |
| incumbent | float | dataset's `Demand Forecast`, comparison only — never a model feature |
| actual | float | nullable (present in backtest window) |
| model_version | str | e.g. `lgbm_q_v3` |

Companion file `forecasts_lt.parquet` — same keys, target is Σ demand over the protection interval
(L+R): `origin_date, store_id, product_id, protection_days, p10_lt, p50_lt, p90_lt`.
WS-2 consumes this file for reorder points — never a hand-summed daily quantile.

### Cross-stream function contract

```python
predict_with_overrides(store_id, product_id, origin_date, horizon, overrides: dict) -> dict
# returns {"p10": float, "p50": float, "p90": float}
# overrides may contain: price, discount, promo_flag, weather, lead_time
# every override is clamped to the observed training range; the return says so
```

## 2. Recommendation contract — `recommendations.json`

See `mocks/recommendations.json` for a filled example matching this exact schema.

## 3. API contract

```
GET  /api/kpis?date=YYYY-MM-DD
GET  /api/forecast?store_id=&product_id=&horizon=14
GET  /api/risk?date=                                   -> heatmap grid, risk score per store×SKU
GET  /api/recommendations?status=pending
POST /api/recommendations/{rec_id}/approve  body: {qty, approver, note}
POST /api/recommendations/{rec_id}/reject   body: {reason, approver}
POST /api/whatif   body: {store_id, product_id, discount, price, promo, lead_time}
POST /api/chat      body: {question} -> {answer, sql, table}
GET  /api/audit
GET  /api/agent-trace/{run_id}
```

## 4. The unblocking move

`scripts/make_mocks.py` emits `mocks/forecasts.parquet` and `mocks/recommendations.json` in exactly
these schemas with plausible fake numbers. WS-3 and WS-4 build against mocks from Day 1 hour 3 and
are never blocked by WS-1/WS-2. When real artifacts land, change one config path
(`STOCKPILOT_DATA_DIR`).

## 5. Non-negotiable rules

- `Demand Forecast` (renamed `incumbent`) is NEVER a model feature — only a comparison column.
  `tests/test_contracts.py` asserts this.
- Features are built by `build_features(df, origin_date)` which physically truncates the frame at
  `origin_date` — no feature may reference a date after the origin (also asserted by a test).
- WAPE = Σ|error| / Σ|actual| (never mean of per-row APEs).
- MASE denominator = in-sample seasonal-naive (m=7) error on the **training** set only.
- Pinball loss / coverage apply only to quantile models; baselines report `"n/a"`.
- ROP is built from the aggregate protection-interval quantile model — never from summed daily
  quantiles (comonotonic bound, not the true quantile of the sum).
