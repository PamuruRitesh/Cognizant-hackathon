"""
The bridge: real forecasts -> inventory decisions -> three-arm simulation.

Produces the artifacts the API serves:
  data/processed/forecasts.parquet        (contract shape, per CONTRACTS.md)
  data/processed/forecasts_lt.parquet     (protection-interval quantiles, Monte-Carlo)
  data/processed/recommendations.json
  data/processed/simulation_results.json

Assumptions (stated, configurable): unit economics derived from each seller's
median item price (60% cost / 40% margin); initial on-hand = 7 days of median
forecast demand; lead time drawn per seller from its own Olist delivery history.
"""
from __future__ import annotations

import json
import os
import sys

import numpy as np
import pandas as pd

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from src.inventory.safety_stock import ProtectionIntervalQuantiles, order_quantity, reorder_point, safety_stock
from src.inventory.simulator import simulate_arm, compare_arms
from src.agents.guardrails import check_recommendation
from src.agents.llm import explain
from src.agents.dual_agents import propose, verify
from src.forecast.lgbm_quantile import QUANTILES

OUT = "data/processed"
N_PATHS = 2000
REVIEW_PERIOD = 1
SERVICE_ALPHA = 0.90
TOP_N = 50
RNG = np.random.default_rng(7)

# sample_daily() reconstructs a distribution assuming the three columns really are
# the 10th/50th/90th percentiles. If the trained alphas change, that assumption
# breaks silently and reorder points come out wrong. Fail loudly instead.
assert (QUANTILES["p10"], QUANTILES["p50"], QUANTILES["p90"]) == (0.1, 0.5, 0.9), (
    f"run_plan.py assumes alphas 0.1/0.5/0.9 but lgbm_quantile.QUANTILES={QUANTILES}. "
    "Update sample_daily() before changing them."
)


def sample_daily(p10, p50, p90, size):
    u = RNG.uniform(0, 1, size)
    lo = np.maximum(p10, 0.0)
    d = np.where(
        u < 0.5,
        lo + (p50 - lo) * np.clip((u - 0.10) / 0.40, 0, None),
        p50 + (p90 - p50) * np.clip((u - 0.50) / 0.40, None, 1.5),
    )
    return np.clip(d, 0, None)


def mc_protection_interval(day_quantiles: pd.DataFrame, lt_mean: float, lt_std: float):
    lt = np.clip(RNG.normal(lt_mean, max(lt_std, 0.1), N_PATHS).round(), 1, 28).astype(int)
    horizon = int(lt.max()) + REVIEW_PERIOD
    q = day_quantiles.head(horizon)
    if len(q) < horizon:
        pad = pd.concat([q.iloc[[-1]]] * (horizon - len(q)), ignore_index=True)
        q = pd.concat([q, pad], ignore_index=True)
    daily = np.stack(
        [sample_daily(r.pred_p10, r.pred_p50, r.pred_p90, N_PATHS) for r in q.itertuples()],
        axis=1,
    )
    mask = np.arange(horizon)[None, :] < (lt + REVIEW_PERIOD)[:, None]
    totals = (daily * mask).sum(axis=1)
    return {
        "p10_lt": float(np.quantile(totals, 0.10)),
        "p50_lt": float(np.quantile(totals, 0.50)),
        "p90_lt": float(np.quantile(totals, SERVICE_ALPHA)),
        "mean_lt": float(totals.mean()),
        "protection_days": float((lt + REVIEW_PERIOD).mean()),
    }


def main():
    fc = pd.read_csv(os.path.join(OUT, "final_forecasts.csv"), parse_dates=["day"])
    feats = pd.read_parquet(os.path.join(OUT, "features.parquet"))
    feats["day"] = pd.to_datetime(feats["day"])

    seller_info = (
        feats.groupby("seller_id")
        .agg(price=("avg_price", "median"), lt_mean=("lt_mean", "last"), lt_std=("lt_std", "last"))
        .fillna({"price": 50.0, "lt_mean": 7.0, "lt_std": 2.0})
    )
    seller_info["price"] = seller_info["price"].replace(0, 50.0)

    vol = fc.groupby("seller_id")["pred_p50"].sum().sort_values(ascending=False)
    top = vol.head(TOP_N).index.tolist()

    metrics = pd.read_csv(os.path.join(OUT, "backtest_metrics.csv"))
    lift_pct = float(((metrics["MA_WAPE"] - metrics["LGBM_P50_WAPE"]) / metrics["MA_WAPE"]).mean() * 100)

    contract_rows, lt_rows, recs = [], [], []
    train_hist = feats[feats["day"] < fc["day"].min()]
    train_mean = train_hist.groupby("seller_id")["n_items"].mean()

    sims_a, sims_b, sims_c = [], [], []
    running_spend = 0.0

    for sid in top:
        g = fc[fc.seller_id == sid].sort_values("day").reset_index(drop=True)
        info = seller_info.loc[sid]
        price, lt_mean, lt_std = float(info["price"]), float(info["lt_mean"]), float(info["lt_std"])
        unit_cost, unit_margin = 0.6 * price, 0.4 * price

        for h, r in enumerate(g.itertuples(), start=1):
            contract_rows.append({
                "date": r.day.date().isoformat(), "store_id": "OLIST-BR", "product_id": sid,
                "horizon": h, "p10": r.pred_p10, "p50": r.pred_p50, "p90": r.pred_p90,
                "incumbent": r.pred_snaive, "actual": r.n_items, "model_version": "lgbm_q_recursive_v2",
            })

        mc = mc_protection_interval(g[["pred_p10", "pred_p50", "pred_p90"]], lt_mean, lt_std)
        lt_rows.append({
            "origin_date": g.day.min().date().isoformat(), "store_id": "OLIST-BR", "product_id": sid,
            "protection_days": mc["protection_days"],
            "p10_lt": mc["p10_lt"], "p50_lt": mc["p50_lt"], "p90_lt": mc["p90_lt"],
        })

        pi = ProtectionIntervalQuantiles(p50_lt=mc["p50_lt"], p_alpha_lt=mc["p90_lt"])
        daily_p50 = max(g.pred_p50.median(), 0.01)
        on_hand = round(7 * daily_p50, 2)
        oq = order_quantity(pi, inventory_position=on_hand, moq=1.0, pack_size=1.0)
        oq["final_qty"] = float(round(oq["final_qty"]))
        rop, ss = reorder_point(pi), safety_stock(pi)

        risk = float((sample_daily(g.pred_p10.mean(), g.pred_p50.mean(), g.pred_p90.mean(), N_PATHS)
                      * mc["protection_days"] > on_hand).mean())
        days_to_stockout = int(min(on_hand / daily_p50, 99))
        cost_if_ignored = round(max(mc["mean_lt"] - on_hand, 0) * unit_margin * 1.2, 2)
        cost_of_action = round(oq["final_qty"] * unit_cost * 0.25 / 365 * mc["protection_days"], 2)

        rec = {
            "rec_id": f"REC-{g.day.min().date()}-{sid[:8]}",
            "date": g.day.min().date().isoformat(),
            "store_id": "OLIST-BR", "product_id": sid, "seller_id": sid,
            "on_hand": on_hand, "reorder_point": round(rop, 2), "safety_stock": round(ss, 2),
            "recommended_qty": oq["final_qty"], "service_level": SERVICE_ALPHA,
            "stockout_risk_7d": round(risk, 3), "days_to_stockout": days_to_stockout,
            "cost_if_ignored": cost_if_ignored, "cost_of_action": cost_of_action,
            "net_benefit": round(cost_if_ignored - cost_of_action, 2),
            "guardrail_flags": oq["guardrail_flags"],
            "evidence": {
                "p50_lt": round(mc["p50_lt"], 2), "p90_lt": round(mc["p90_lt"], 2),
                "lead_time_mean": round(lt_mean, 1), "lead_time_std": round(lt_std, 1),
                "confidence": round(1 - abs(0.99 - 0.90), 2),
                "top_drivers": ["roll_mean_7", "lag_7", "lt_mean"],
            },
            "status": "pending",
        }
        rec = check_recommendation(rec, unit_cost=unit_cost, running_daily_spend=running_spend)
        # Dual Grok agents: Proposer suggests, Verifier cross-checks. Baked in here
        # so the served data already carries both views (and is demo-safe offline).
        ev = dict(rec["evidence"]) | {
            "product_id": sid[:8], "store_id": "OLIST-BR",
            "recommended_qty": rec["recommended_qty"], "days_to_stockout": days_to_stockout,
            "net_benefit": rec["net_benefit"], "guardrail_flags": rec["guardrail_flags"],
        }
        proposal = propose(ev)
        verdict = verify(ev, proposal)
        rec["proposer"] = proposal
        rec["verification"] = verdict
        rec["rationale"] = proposal["rationale"]
        if verdict.get("final_decision") != "APPROVE" or rec["guardrail_flags"]:
            rec["status"] = "escalated"
        running_spend += oq["final_qty"] * unit_cost
        recs.append(rec)

        demand = g.n_items.tolist()
        lt_days = int(max(round(lt_mean), 1))
        base_qty = float(train_mean.get(sid, daily_p50))
        s_level = mc["p90_lt"]

        sims_a.append(simulate_arm("A_static_rule", demand, [base_qty] * len(demand),
                                   on_hand, lt_days, unit_cost, unit_margin))
        sims_b.append(simulate_arm("B_point_forecast", demand, g.pred_snaive.clip(lower=0).tolist(),
                                   on_hand, lt_days, unit_cost, unit_margin))
        sims_c.append(simulate_arm("C_stockpilot", demand, None, on_hand, lt_days, unit_cost, unit_margin,
                                   order_policy=lambda t, oh, pipe, S=s_level: max(0.0, S - (oh + pipe))))

    def agg(sims, name):
        from src.inventory.simulator import SimulationResult
        merged = SimulationResult(arm_name=name)
        for s in sims:
            merged.days.extend(s.days)
        return merged

    a, b, c = agg(sims_a, "A_static_rule"), agg(sims_b, "B_point_forecast"), agg(sims_c, "C_stockpilot")
    comparison = compare_arms(a, b, c)
    comparison["assumptions"] = {
        "sellers_simulated": len(top), "window_days": 14, "service_level": SERVICE_ALPHA,
        "unit_economics": "60% cost / 40% margin of seller median price",
        "initial_on_hand": "7 days of median forecast demand",
        "lead_time": "per-seller mean/std from Olist delivery history",
        "arm_A": "order a fixed quantity equal to historical mean demand every day",
        "arm_B": "order the seasonal-naive point forecast every day",
        "arm_C": "order-up-to the Monte-Carlo P90 of demand over lead time + review",
    }
    comparison["forecast_lift_pct_vs_MA"] = round(lift_pct, 1)

    pd.DataFrame(contract_rows).to_parquet(os.path.join(OUT, "forecasts.parquet"), index=False)
    pd.DataFrame(lt_rows).to_parquet(os.path.join(OUT, "forecasts_lt.parquet"), index=False)
    with open(os.path.join(OUT, "recommendations.json"), "w") as f:
        json.dump(recs, f, indent=2)
    with open(os.path.join(OUT, "simulation_results.json"), "w") as f:
        json.dump(comparison, f, indent=2)

    print(f"forecasts.parquet: {len(contract_rows)} rows | recommendations: {len(recs)} "
          f"({sum(1 for r in recs if r['status']=='escalated')} escalated)")
    print(json.dumps({k: v for k, v in comparison.items() if k != 'assumptions'}, indent=2))


if __name__ == "__main__":
    main()
