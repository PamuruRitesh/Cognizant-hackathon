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
