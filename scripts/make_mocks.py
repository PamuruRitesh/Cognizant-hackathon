"""
Day 1, hour 3 — the unblocking move.

Emits mocks/forecasts.parquet, mocks/forecasts_lt.parquet and
mocks/recommendations.json in EXACTLY the schemas frozen in CONTRACTS.md,
filled with plausible fake numbers, so WS-3 (API/UI) and WS-4 (agents) can
build against them without waiting on WS-1/WS-2.

Run: python scripts/make_mocks.py
"""
import json
import os
import numpy as np
import pandas as pd

rng = np.random.default_rng(42)

STORES = [f"S{i}" for i in range(1, 6)]
PRODUCTS = [f"P{i:04d}" for i in range(1, 21)]
HORIZONS = list(range(1, 15))
DATES = pd.date_range("2023-10-01", "2023-10-14", freq="D")

OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "mocks")
os.makedirs(OUT_DIR, exist_ok=True)


def make_forecasts() -> pd.DataFrame:
    rows = []
    for date in DATES:
        for store in STORES:
            for product in PRODUCTS:
                for h in HORIZONS:
                    base = rng.uniform(20, 150)
                    p50 = max(0.0, base + rng.normal(0, 5))
                    spread = base * rng.uniform(0.15, 0.35)
                    p10 = max(0.0, p50 - spread)
                    p90 = p50 + spread
                    incumbent = max(0.0, p50 + rng.normal(0, 3))  # ~ "oracle-ish", mock only
                    actual = max(0.0, p50 + rng.normal(0, spread / 2))
                    rows.append(
                        dict(
                            date=date.date().isoformat(),
                            store_id=store,
                            product_id=product,
                            horizon=h,
                            p10=round(p10, 2),
                            p50=round(p50, 2),
                            p90=round(p90, 2),
                            incumbent=round(incumbent, 2),
                            actual=round(actual, 2),
                            model_version="mock_v0",
                        )
                    )
    return pd.DataFrame(rows)


def make_forecasts_lt(protection_days: int = 4) -> pd.DataFrame:
    rows = []
    for date in DATES:
        for store in STORES:
            for product in PRODUCTS:
                base = rng.uniform(80, 500)
                p50 = base
                spread = base * rng.uniform(0.15, 0.3)
                rows.append(
                    dict(
                        origin_date=date.date().isoformat(),
                        store_id=store,
                        product_id=product,
                        protection_days=protection_days,
                        p10_lt=round(max(0.0, p50 - spread), 2),
                        p50_lt=round(p50, 2),
                        p90_lt=round(p50 + spread, 2),
                    )
                )
    return pd.DataFrame(rows)


def make_recommendations(n: int = 25) -> list:
    recs = []
    for i in range(n):
        store = rng.choice(STORES)
        product = rng.choice(PRODUCTS)
        date = pd.Timestamp(rng.choice(DATES)).date().isoformat()
        on_hand = int(rng.uniform(0, 60))
        p50_lt = float(rng.uniform(60, 200))
        p90_lt = p50_lt + rng.uniform(10, 60)
        reorder_point = round(p90_lt, 1)
        safety_stock = round(reorder_point - p50_lt, 1)
        recommended_qty = int(max(0, reorder_point - on_hand))
        cost_if_ignored = round(recommended_qty * rng.uniform(60, 120), 2)
        cost_of_action = round(recommended_qty * rng.uniform(10, 25), 2)
        flags = []
        if recommended_qty * rng.uniform(10, 25) > 4000:
            flags.append("exceeds_daily_budget")
        recs.append(
            {
                "rec_id": f"REC-{date}-{store}-{product}",
                "date": date,
                "store_id": store,
                "product_id": product,
                "on_hand": on_hand,
                "reorder_point": reorder_point,
                "safety_stock": safety_stock,
                "recommended_qty": recommended_qty,
                "service_level": 0.95,
                "stockout_risk_7d": round(float(rng.uniform(0.1, 0.95)), 2),
                "days_to_stockout": int(rng.integers(1, 10)),
                "cost_if_ignored": cost_if_ignored,
                "cost_of_action": cost_of_action,
                "net_benefit": round(cost_if_ignored - cost_of_action, 2),
                "guardrail_flags": flags,
                "evidence": {
                    "p50_lt": round(p50_lt, 1),
                    "p90_lt": round(p90_lt, 1),
                    "lead_time": 3,
                    "top_drivers": ["holiday_flag", "discount_pct", "lag_7"],
                },
                "rationale": (
                    f"Order {recommended_qty} units of {product} at {store} — "
                    f"stockout risk within {int(rng.integers(1,10))} days at current run rate. "
                    f"[MOCK narrative — replace with Explainer Agent output]"
                ),
                "status": "pending",
            }
        )
    return recs


if __name__ == "__main__":
    fc = make_forecasts()
    fc.to_parquet(os.path.join(OUT_DIR, "forecasts.parquet"), index=False)
    fc_lt = make_forecasts_lt()
    fc_lt.to_parquet(os.path.join(OUT_DIR, "forecasts_lt.parquet"), index=False)
    recs = make_recommendations()
    with open(os.path.join(OUT_DIR, "recommendations.json"), "w") as f:
        json.dump(recs, f, indent=2)
    print(f"Wrote {len(fc)} forecast rows, {len(fc_lt)} lt rows, {len(recs)} recommendations to {OUT_DIR}")
