"""
Export StockPilot artifacts as CSVs that fill the Neon/Postgres schema.

Reads:  data/processed/{recommendations.json, forecasts.parquet, forecasts_lt.parquet,
        features.parquet, simulation_results.json, backtest_metrics.csv}
Writes: neon_seed/*.csv  (+ load_order.sql, README.txt)

Covers the 8 base tables plus the 3 added by db/02_schema_extension.sql, so the
API can serve every endpoint from Postgres instead of from files.

UUIDs are generated deterministically (uuid5) so cross-table references
(llm_audit_logs.po_id, purchase_orders.reviewer_user_id) stay consistent across
re-runs.
"""
from __future__ import annotations

import csv
import json
import os
import uuid

import pandas as pd

OUT = "neon_seed"
NS = uuid.UUID("11111111-2222-3333-4444-555555555555")  # stable namespace
STORE_ID = "OLIST-BR"
NOW = "2018-08-28T09:00:00Z"  # fixed draft time (day after the forecast window)
PROC = "data/processed"


def uid(*parts) -> str:
    return str(uuid.uuid5(NS, "|".join(str(p) for p in parts)))


def num(v, default=None):
    """Postgres-safe number: blank cell becomes NULL rather than a bad cast."""
    try:
        if v is None:
            return "" if default is None else default
        f = float(v)
        return "" if f != f else f  # NaN -> NULL
    except (TypeError, ValueError):
        return "" if default is None else default


def write_csv(name, header, rows):
    with open(os.path.join(OUT, name), "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(header)
        w.writerows(rows)
    print(f"  {name:30s} {len(rows):7,} rows")


TABLES = []  # (table, filename, column list) -- drives load_order.sql


def emit(table, name, header, rows):
    write_csv(name, header, rows)
    TABLES.append((table, name, ", ".join(header)))


def main():
    os.makedirs(OUT, exist_ok=True)
    recs = json.load(open(f"{PROC}/recommendations.json"))
    fc = pd.read_parquet(f"{PROC}/forecasts.parquet")
    feats = pd.read_parquet(f"{PROC}/features.parquet")
    feats["day"] = pd.to_datetime(feats["day"])

    # Preserve the pipeline's own order (recommendations first, then any
    # forecast-only SKUs). Sorting here would reshuffle every list in the UI.
    sku_ids = list(dict.fromkeys([r["product_id"] for r in recs]
                                 + list(fc["product_id"])))
    seller = feats.groupby("seller_id").agg(price=("avg_price", "median"), lt=("lt_mean", "last"))
    rec_by_sku = {r["product_id"]: r for r in recs}

    # ---- 1. stores -------------------------------------------------------
    emit("stores", "01_stores.csv", ["store_id", "store_name"],
         [[STORE_ID, "Olist Brazil Marketplace"]])

    # ---- 2. skus ---------------------------------------------------------
    rows = []
    for sid in sku_ids:
        r = rec_by_sku.get(sid, {})
        price = float(seller.loc[sid, "price"]) if sid in seller.index else 50.0
        if not price or price != price:
            price = 50.0
        lt = r.get("evidence", {}).get("lead_time_mean")
        if lt is None:
            lt = seller.loc[sid, "lt"] if sid in seller.index else 7
        rows.append([sid, STORE_ID, "General Merchandise",
                     int(round(r.get("on_hand", 0) or 0)), round(0.6 * price, 2),
                     max(int(round(float(lt))), 0), len(rows)])
    emit("skus", "02_skus.csv",
         ["sku_id", "store_id", "product_category", "current_stock", "unit_cost",
          "lead_time_days", "rank_order"], rows)

    # ---- 3. inventory_history -------------------------------------------
    hist = feats[feats.seller_id.isin(sku_ids)][["seller_id", "day", "n_items"]]
    hist = hist[hist.n_items >= 0]
    emit("inventory_history", "03_inventory_history.csv",
         ["sku_id", "recorded_date", "opening_stock", "units_sold", "units_received", "closing_stock"],
         [[s, d.date().isoformat(), 0, int(n), 0, 0] for s, d, n in
          zip(hist.seller_id, hist.day, hist.n_items)])

    # ---- 4. daily_forecasts (now carries incumbent + actual for the KPIs) --
    risk = {r["product_id"]: float(r.get("stockout_risk_7d") or 0) for r in recs}
    rows = []
    for t in fc.itertuples():
        lo, mid, hi = sorted([max(float(t.p10), 0), max(float(t.p50), 0), max(float(t.p90), 0)])
        rows.append([t.product_id, t.date, lo, mid, hi,
                     round(min(max(risk.get(t.product_id, 0.0), 0.0), 1.0), 4),
                     getattr(t, "store_id", STORE_ID), int(getattr(t, "horizon", 0) or 0),
                     num(getattr(t, "incumbent", None)), num(getattr(t, "actual", None)),
                     getattr(t, "model_version", "") or ""])
    emit("daily_forecasts", "04_daily_forecasts.csv",
         ["sku_id", "target_date", "p10_demand", "p50_demand", "p90_demand", "stockout_risk_score",
          "store_id", "horizon", "incumbent_forecast", "actual_demand", "model_version"], rows)

    # ---- 5. users --------------------------------------------------------
    planner, admin = uid("user", "planner"), uid("user", "admin")
    emit("users", "05_users.csv", ["user_id", "email", "role"],
         [[planner, "planner@stockpilot.ai", "PLANNER"],
          [admin, "admin@stockpilot.ai", "ADMIN"]])

    # ---- 6. purchase_orders (recommendation + its economics) -------------
    status_map = {"pending": "PENDING_APPROVAL", "escalated": "PENDING_APPROVAL",
                  "approved": "APPROVED", "rejected": "REJECTED", "executed": "EXECUTED"}
    po_id_by_rec, rows = {}, []
    for r in recs:
        po_id = uid("po", r["rec_id"])
        po_id_by_rec[r["rec_id"]] = po_id
        rows.append([
            po_id, r["product_id"], status_map.get(r.get("status", "pending"), "PENDING_APPROVAL"),
            int(round(r.get("recommended_qty", 0) or 0)),
            json.dumps(r.get("guardrail_flags", [])), NOW,
            "", "", "", "", "",                       # human_* / reviewer / reviewed_at / executed_at
            r["rec_id"], r.get("store_id") or STORE_ID, r.get("date", ""),
            num(r.get("on_hand")), num(r.get("reorder_point")), num(r.get("safety_stock")),
            num(r.get("service_level")), num(r.get("days_to_stockout")), num(r.get("stockout_risk_7d")),
            num(r.get("cost_if_ignored")), num(r.get("cost_of_action")), num(r.get("net_benefit")),
            r.get("rationale") or "",
            json.dumps(r.get("evidence") or {}),
            json.dumps(r.get("proposer") or {}),
            json.dumps(r.get("verification") or {}),
        ])
    emit("purchase_orders", "06_purchase_orders.csv",
         ["po_id", "sku_id", "status", "ai_recommended_qty", "ai_guardrail_flags", "ai_drafted_at",
          "human_approved_qty", "reviewer_user_id", "human_feedback", "reviewed_at", "executed_at",
          "rec_id", "store_id", "decision_date", "on_hand", "reorder_point", "safety_stock",
          "service_level", "days_to_stockout", "stockout_risk_7d", "cost_if_ignored",
          "cost_of_action", "net_benefit", "rationale", "evidence", "proposer", "verification"], rows)

    # ---- 7. llm_audit_logs ----------------------------------------------
    rows = []
    for r in recs:
        prop = r.get("proposer") or {}
        ctx = {"evidence": r.get("evidence", {}), "recommended_qty": r.get("recommended_qty"),
               "days_to_stockout": r.get("days_to_stockout"), "net_benefit": r.get("net_benefit"),
               "verifier": r.get("verification", {})}
        rows.append([uid("log", r["rec_id"]), po_id_by_rec[r["rec_id"]],
                     "grok (xai) via StockPilot dual-agent", json.dumps(ctx),
                     r.get("rationale") or prop.get("rationale", ""), "", ""])
    emit("llm_audit_logs", "07_llm_audit_logs.csv",
         ["log_id", "po_id", "model_version", "input_prompt_context", "generated_rationale",
          "prompt_tokens", "completion_tokens"], rows)

    # ---- 8. system_audit_trace ------------------------------------------
    rows = []
    for r in recs:
        rows.append([r["rec_id"], "PURCHASE_ORDER", "AI_AGENT", "Replenishment Planner", "DRAFTED",
                     f"AI drafted PO for {int(round(r.get('recommended_qty', 0) or 0))} units", NOW])
        v = r.get("verification") or {}
        rows.append([r["rec_id"], "PURCHASE_ORDER", "AI_AGENT", "Verifier Agent",
                     v.get("verdict", "REVIEWED"), "; ".join(v.get("reasons", []))[:500], NOW])
    # existing human approvals from the file-based audit log carry over too
    alog = f"{PROC}/audit_log.json"
    if os.path.exists(alog):
        for e in json.load(open(alog)):
            rows.append([e.get("rec_id", ""), "PURCHASE_ORDER", "HUMAN",
                         e.get("approver") or "planner", e.get("action", ""),
                         e.get("note") or "", e.get("timestamp") or NOW,
                         json.dumps({k: e.get(k) for k in ("qty", "note", "approver")})])
    rows = [r if len(r) == 8 else r + [json.dumps({})] for r in rows]
    emit("system_audit_trace", "08_system_audit_trace.csv",
         ["entity_id", "entity_type", "actor_type", "actor_name", "action", "details",
          "timestamp", "payload"], rows)

    # ---- 9. leadtime_forecasts (protection-interval quantiles) -----------
    lt_path = f"{PROC}/forecasts_lt.parquet"
    if os.path.exists(lt_path):
        lt = pd.read_parquet(lt_path)
        emit("leadtime_forecasts", "09_leadtime_forecasts.csv",
             ["sku_id", "origin_date", "store_id", "protection_days", "p10_lt", "p50_lt", "p90_lt"],
             [[t.product_id, t.origin_date, getattr(t, "store_id", STORE_ID),
               num(t.protection_days), num(t.p10_lt), num(t.p50_lt), num(t.p90_lt)]
              for t in lt.itertuples()])

    # ---- 10. backtest_metrics (one row per fold, metrics as JSON) --------
    bt_path = f"{PROC}/backtest_metrics.csv"
    if os.path.exists(bt_path):
        bt = pd.read_csv(bt_path)
        rows = []
        for rec in bt.to_dict("records"):
            fold = str(rec.pop("fold", "fold"))
            clean = {k: (None if pd.isna(v) else v) for k, v in rec.items()}
            rows.append(["retail", fold, json.dumps(clean)])
        emit("backtest_metrics", "10_backtest_metrics.csv", ["pipeline", "fold", "metrics"], rows)

    # ---- 11. simulation_runs (the three-arm cost comparison) -------------
    sim_path = f"{PROC}/simulation_results.json"
    if os.path.exists(sim_path):
        s = json.load(open(sim_path))
        tot = s.get("totals", {})
        emit("simulation_runs", "11_simulation_runs.csv",
             ["run_label", "pipeline", "cost_a_current", "cost_b_incumbent", "cost_c_stockpilot",
              "system_lift", "forecast_lift", "forecast_lift_pct_ma", "assumptions"],
             [["baseline", "retail",
               num(tot.get("A_current_practice")), num(tot.get("B_incumbent_forecast")),
               num(tot.get("C_stockpilot")),
               json.dumps(s.get("C_vs_A_system_lift") or {}),
               json.dumps(s.get("C_vs_B_forecast_lift") or {}),
               num(s.get("forecast_lift_pct_vs_MA")),
               json.dumps(s.get("assumptions") or {})]])

    # ---- load_order.sql --------------------------------------------------
    with open(os.path.join(OUT, "load_order.sql"), "w") as f:
        f.write("-- Load in this order (respects foreign keys). Run in psql or the Neon SQL editor.\n")
        f.write("-- Requires db/01_schema_base.sql and db/02_schema_extension.sql to have run first.\n")
        f.write("-- \\copy is client-side, so run it from inside the neon_seed/ folder.\n\n")
        for table, fname, cols in TABLES:
            f.write(f"\\copy {table} ({cols}) FROM '{fname}' WITH (FORMAT csv, HEADER true, NULL '');\n")
    print(f"\nwrote {OUT}/load_order.sql  ({len(TABLES)} tables)")


if __name__ == "__main__":
    main()
