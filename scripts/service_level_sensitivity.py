"""
Service-level sensitivity table (90/95/99%).

Answers "what does buying more safety margin actually cost us?" by rerunning
Arm C (StockPilot) of the three-arm simulator at three service levels, holding
everything else fixed: same top-50 sellers, same demand history, same lead
times, same starting on-hand, same MC sampling seed. Arms A and B don't depend
on service level, so C at 90% (this table's first row) reproduces the
headline numbers in data/processed/simulation_results.json exactly.

Only the order-up-to target changes: S = Q_alpha(D over protection interval)
for alpha in {0.90, 0.95, 0.99}. Higher alpha -> higher S -> more holding
cost, fewer/cheaper stockouts. This is the trade-off curve, not a claim that
one level is "right" — that's a business call to defend out loud, not a
model output.

Writes docs/service_level_sensitivity.json (raw numbers) and prints a
markdown table for docs/inventory_math.md.
"""
from __future__ import annotations

import json
import os
import sys

import numpy as np
import pandas as pd

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from src.inventory.simulator import simulate_arm, compare_arms, SimulationResult

OUT = "data/processed"
N_PATHS = 2000
REVIEW_PERIOD = 1
TOP_N = 50
SERVICE_LEVELS = [0.90, 0.95, 0.99]
RNG_SEED = 7


def sample_daily(rng, p10, p50, p90, size):
    u = rng.uniform(0, 1, size)
    lo = np.maximum(p10, 0.0)
    d = np.where(
        u < 0.5,
        lo + (p50 - lo) * np.clip((u - 0.10) / 0.40, 0, None),
        p50 + (p90 - p50) * np.clip((u - 0.50) / 0.40, None, 1.5),
    )
    return np.clip(d, 0, None)


def mc_protection_interval(rng, day_quantiles: pd.DataFrame, lt_mean: float, lt_std: float, alpha: float):
    """Same Monte-Carlo protection-interval model as run_plan.py, generalized
    to an arbitrary service level alpha (run_plan.py hardcodes alpha=0.90)."""
    lt = np.clip(rng.normal(lt_mean, max(lt_std, 0.1), N_PATHS).round(), 1, 28).astype(int)
    horizon = int(lt.max()) + REVIEW_PERIOD
    q = day_quantiles.head(horizon)
    if len(q) < horizon:
        pad = pd.concat([q.iloc[[-1]]] * (horizon - len(q)), ignore_index=True)
        q = pd.concat([q, pad], ignore_index=True)
    daily = np.stack(
        [sample_daily(rng, r.pred_p10, r.pred_p50, r.pred_p90, N_PATHS) for r in q.itertuples()],
        axis=1,
    )
    mask = np.arange(horizon)[None, :] < (lt + REVIEW_PERIOD)[:, None]
    totals = (daily * mask).sum(axis=1)
    return {
        "p50_lt": float(np.quantile(totals, 0.50)),
        "p_alpha_lt": float(np.quantile(totals, alpha)),
        "mean_lt": float(totals.mean()),
    }


def run_at_service_level(alpha: float, fc, seller_info, top, train_mean):
    """Rerun Arm A, B, C at the given service level. A and B are unaffected
    by alpha (they don't consult the quantile model) — they're recomputed
    anyway so the comparison table is self-contained and doesn't rely on a
    previous run's cached totals."""
    sims_a, sims_b, sims_c = [], [], []
    avg_order_up_to = []
    avg_safety_stock = []

    for sid in top:
        # Fresh RNG per (seller, alpha) so all three service levels sample
        # from the same effective demand distribution — only alpha differs.
        rng = np.random.default_rng(RNG_SEED)
        g = fc[fc.seller_id == sid].sort_values("day").reset_index(drop=True)
        info = seller_info.loc[sid]
        price, lt_mean, lt_std = float(info["price"]), float(info["lt_mean"]), float(info["lt_std"])
        unit_cost, unit_margin = 0.6 * price, 0.4 * price

        mc = mc_protection_interval(rng, g[["pred_p10", "pred_p50", "pred_p90"]], lt_mean, lt_std, alpha)
        daily_p50 = max(g.pred_p50.median(), 0.01)
        on_hand = round(7 * daily_p50, 2)
        s_level = mc["p_alpha_lt"]
        avg_order_up_to.append(s_level)
        avg_safety_stock.append(s_level - mc["p50_lt"])

        demand = g.n_items.tolist()
        lt_days = int(max(round(lt_mean), 1))
        base_qty = float(train_mean.get(sid, daily_p50))

        sims_a.append(simulate_arm("A_static_rule", demand, [base_qty] * len(demand),
                                   on_hand, lt_days, unit_cost, unit_margin))
        sims_b.append(simulate_arm("B_point_forecast", demand, g.pred_snaive.clip(lower=0).tolist(),
                                   on_hand, lt_days, unit_cost, unit_margin))
        sims_c.append(simulate_arm("C_stockpilot", demand, None, on_hand, lt_days, unit_cost, unit_margin,
                                   order_policy=lambda t, oh, pipe, S=s_level: max(0.0, S - (oh + pipe))))

    def agg(sims, name):
        merged = SimulationResult(arm_name=name)
        for s in sims:
            merged.days.extend(s.days)
        return merged

    a, b, c = agg(sims_a, "A"), agg(sims_b, "B"), agg(sims_c, "C")
    comparison = compare_arms(a, b, c)

    return {
        "service_level": alpha,
        "arm_c_total_cost": round(c.total_cost, 2),
        "arm_c_holding_cost": round(c.total_holding_cost, 2),
        "arm_c_stockout_cost": round(c.total_stockout_cost, 2),
        "arm_c_stockout_days": c.stockout_days,
        "arm_c_avg_on_hand": round(c.avg_on_hand, 2),
        "avg_order_up_to_level": round(float(np.mean(avg_order_up_to)), 2),
        "avg_safety_stock": round(float(np.mean(avg_safety_stock)), 2),
        "C_vs_A_system_lift": comparison["C_vs_A_system_lift"],
        "C_vs_B_forecast_lift": comparison["C_vs_B_forecast_lift"],
        "totals": comparison["totals"],
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

    # Use the exact top-50 seller set already committed to recommendations.json
    # rather than recomputing vol.head(TOP_N) here: with numpy/pandas versions
    # newer than requirements.txt's pins, float-sum tie-breaking at the cutoff
    # picks a slightly different set of sellers (verified: 3 of 50 differ),
    # which is enough to move total simulated cost by ~9%. Reusing the
    # committed list keeps this table's 90% row consistent with the headline
    # numbers in simulation_results.json.
    with open(os.path.join(OUT, "recommendations.json")) as f:
        committed_recs = json.load(f)
    top = [r["seller_id"] for r in committed_recs]

    train_hist = feats[feats["day"] < fc["day"].min()]
    train_mean = train_hist.groupby("seller_id")["n_items"].mean()

    results = [run_at_service_level(a, fc, seller_info, top, train_mean) for a in SERVICE_LEVELS]

    out = {
        "sellers_simulated": len(top),
        "window_days": 14,
        "note": (
            "Arm A and Arm B costs are recomputed at each row for a self-contained table; "
            "they don't depend on service level and are ~constant across rows within MC noise. "
            "Only Arm C (order-up-to target) responds to the service level."
        ),
        "rows": results,
    }
    with open(os.path.join(OUT, "service_level_sensitivity.json"), "w") as f:
        json.dump(out, f, indent=2)

    print("| Service level | Arm C total cost | Holding cost | Stockout cost | Stockout days | Avg on-hand | Avg order-up-to (S) | Avg safety stock |")
    print("|---|---|---|---|---|---|---|---|")
    for r in results:
        print(
            f"| {int(r['service_level']*100)}% | ${r['arm_c_total_cost']:,.2f} | "
            f"${r['arm_c_holding_cost']:,.2f} | ${r['arm_c_stockout_cost']:,.2f} | "
            f"{r['arm_c_stockout_days']} | {r['arm_c_avg_on_hand']:.1f} | "
            f"{r['avg_order_up_to_level']:.1f} | {r['avg_safety_stock']:.1f} |"
        )


if __name__ == "__main__":
    main()
