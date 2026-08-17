# Cognizant-hackathon

# StockPilot — Autonomous Demand & Replenishment Control Tower

Agentic control tower that forecasts demand with confidence bounds, spots stockouts before they
happen, and drafts purchase orders for a human planner to approve in one click.

## Quickstart

**For Linux/macOS (or if you have `make` installed):**
```bash
make setup      # create venv, install deps
make mocks      # generate mock data so every stream can build in parallel
make data       # (once real CSV is in data/raw/) build DuckDB + features
make train      # train baselines + LightGBM quantile models
make api         # run FastAPI on :8000
cd frontend && npm install && npm run dev  # run React UI on :5173
make demo        # docker compose up, DEMO_MODE=true, seeded state
make test        # run pytest (contracts, inventory math, guardrails)
```

**For Windows:**
```powershell
# 1. Set up virtual environment and install dependencies
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt

# 2. Generate mock data
python scripts/make_mocks.py

# 3. Run FastAPI server (runs on localhost:8000)
python -m uvicorn src.api.main:app --reload --port 8000

# 4. Run React UI (runs on localhost:5173)
cd frontend
npm install
npm run dev
```

## Repo map

```
src/data/        Olist CSV -> DuckDB loader (load_data.py), feature engineering (features.py)
src/forecast/     baselines, LightGBM quantile model, backtest, metrics, SHAP
src/inventory/    safety stock, order policy, cost model, 3-arm simulator
src/agents/       LangGraph state machine (7 nodes) + guardrails + llm wrapper
src/api/          FastAPI service (contract endpoints in CONTRACTS.md)
frontend/         React control tower (Vite + CSS)
src/ui/           [Deprecated] Streamlit control tower
mocks/            fake forecasts.parquet / recommendations.json — unblocks WS-3/WS-4 on Day 1
tests/            test_contracts.py test_inventory.py test_guardrails.py
docs/             architecture, inventory_math, model_card, eval_report, demo_script
```

See `CONTRACTS.md` for the frozen data/API contracts — treat changes as requiring all-team agreement.
See `AI_USAGE.md` for what was AI-assisted vs hand-written.

## Status

Day-1 scaffold: mocks, contracts, stub endpoints, stub LangGraph skeleton, baseline forecasting,
inventory math functions with unit tests. Swap `mocks/` for `data/processed/` once WS-1 ships real
`forecasts.parquet`.
**PAIR A**
## Status

**Complete for this session (branch `ws1/olist-features`):**

- ✅ All 9 Olist CSVs loaded into `olist.duckdb`, row counts verified against published figures
- ✅ Full data quality audit written (`docs/data_quality_report.md`) — schema, nulls, duplicate
  keys, negative-value checks, timestamp-sequence violations (flagged and excluded, not silently
  fixed), autocorrelation, lead-time distribution, per-seller heterogeneity
- ✅ `build_features(con, origin_date)` shipped in `src/data/features.py` — seller × day panel,
  23 columns, physically truncated at `origin_date` (no future leakage)
- ✅ 5/5 tests passing in `tests/test_features.py` — leakage, fabrication, correctness all covered
- ✅ `data/processed/features.parquet` generated — 1,106,897 rows × 23 columns
- ✅ Old mock scaffold (`loader.py`, `quality.py`, built for the abandoned synthetic dataset)
  removed, dangling references fixed in `Makefile` and `README.md`

**Complete for this session (Forecasting Pipeline):**
- ✅ Implemented `src/forecast/pipeline.py` to train models and evaluate metrics per `seller_id` on the processed feature data.
- ✅ Structured data into 3 backtesting folds (14-days each) and one 14-day holdout fold.
- ✅ Configured separate P10, P50, and P90 LightGBM regressors with automatic crossing correction (`rearrange_quantiles`).
- ✅ Implemented evaluation metrics: MAE, RMSE, SMAPE (point forecasts), and P10-P90 coverage (interval forecasts).
- ✅ Generated SHAP values on the final test holdout using the P50 model.
- ✅ Successfully ran end-to-end backtesting via `make train`, generating `data/processed/final_forecasts.csv` and `data/processed/backtest_metrics.csv`.

**Complete for this session (Pair C — Backend & Frontend):**
- ✅ Implemented a fully-featured React-based enterprise Control Tower UI in `frontend/`.
- ✅ Built `SKUDetail` with P10/P50/P90 forecasting fan charts and inventory projections using `recharts`.
- ✅ Built `ApprovalQueue` to handle pending recommendations with approve/reject actions and Guardrail badges.
- ✅ Built `WhatIfSimulator` with interactive controls for price, discount, promo, and lead time overrides.
- ✅ Built `AuditTrace` to visualize agent and human interactions over time.
- ✅ Refined overall UX with Stitch-inspired glassmorphic styling, animated skeleton loaders, micro-animations, toast notifications, and `lucide-react` icons.
- ✅ Strictly adhered to `CONTRACTS.md` by consuming existing API endpoints.

**Complete for this session (Pair 4 — Agent Orchestration & Integration):**
- ✅ Integrated React frontend with FastAPI backend in `docker-compose.yml`.
- ✅ Resolved `test_contracts.py` test failures.
- ✅ Created presentation deck (`docs/deck.md`) and demo script (`docs/demo_script.md`).

**Core repairs (branch `fixes/core-repairs`):**
- ✅ Backtest re-anchored to live data: the Olist panel is truncated at the last day of real
  activity (2018-08-27). The previous folds sat in a dead zone (Sept 2018 total = 1 item) where
  every model scored perfectly by predicting zero — those metrics were meaningless.
- ✅ Multi-step leakage removed: 14-day windows are now predicted recursively, with lag/rolling
  features rebuilt from the model's own earlier predictions instead of test-window actuals.
- ✅ Agent graph fixed and verified: `SqliteSaver.from_conn_string` is a context manager in
  checkpoint-sqlite 1.x — the compiled graph never actually ran. Now builds, pauses at the
  approval interrupt, resumes, and writes the shared audit log (langgraph pinned to 0.2.76).
- ✅ Forecast -> inventory bridge shipped (`make plan` / `scripts/run_plan.py`): real
  recommendations.json, protection-interval quantiles via Monte-Carlo over per-seller lead-time
  distributions, and the three-arm cost simulation (`simulation_results.json`).
- ✅ `/api/kpis` accuracy lift is now computed from `backtest_metrics.csv` (was a hardcoded 18.4).
- ✅ `/api/whatif` wired to the persisted LightGBM models via `predict_with_overrides`.
- ⚠️ Known issue for WS-1: interval coverage is ~99% against a nominal 80% — the P10-P90 band is
  too wide and needs recalibration before the service-level claim goes in the deck.
- ⏳ Still stubbed: `/api/chat` (Analyst agent), LLM provider call (template fallback only).

**Complete for this session (UI/UX Refinements & Integration):**
- ✅ **Server-Side Pagination:** Replaced client-side pagination with native API pagination (`page`/`limit`) across `ApprovalQueue`, `AuditTrace`, and `RiskHeatmap` for true enterprise scalability.
- ✅ **Dynamic Notification Feed:** Overhauled the top-bar Alerts dropdown to fetch live critical stockout risks and pending PO approvals directly from the database endpoints.
- ✅ **Glassmorphic Upgrades:** Replaced native HTML inputs with custom glassmorphic `CustomSelect` dropdowns and resolved overlapping z-index issues.
- ✅ **Inline Approval Flow:** Revamped the Approval Queue into an inline-expanding row flow for quantity adjustments and custom reasoning.
- ✅ **What-If Engine:** Fixed the ML model multiplier logic ensuring `Discount` and `Promo` overrides cleanly interact with the LightGBM models.
