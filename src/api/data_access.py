"""
Single place every route gets its data from.

Reads come from Postgres/Neon when DATABASE_URL is set and reachable. If it is
not, each loader falls back to the parquet/JSON files it used before, so the
app still runs with no database at all (set DB_FALLBACK=false to disable that
and fail loudly instead).

The return shapes are identical either way -- the routes cannot tell which
source answered, which is what makes the switch safe.

Not in Postgres, on purpose:
  * trained models (data/processed/models/*.joblib) -- binaries belong on disk
    or in object storage, not in a transactional database
  * features.parquet -- 1.1M rows of model input used by the What-If recursive
    predictor; it is a model artifact, and round-tripping it per request would
    add seconds to every call
"""
from __future__ import annotations

import json
import os

import pandas as pd

from . import db

_ROOT = os.path.join(os.path.dirname(__file__), "..", "..")
_PROCESSED = os.path.join(_ROOT, "data", "processed")
_DEFAULT = os.path.join(_ROOT, "mocks")
DATA_DIR = os.environ.get("STOCKPILOT_DATA_DIR", _DEFAULT)

STORE_ID_DEFAULT = "OLIST-BR"


def _use_db() -> bool:
    return db.database_url() is not None


def _fallback(exc: Exception):
    """Re-raise if the operator asked us to fail loudly instead of degrading."""
    if not db.fallback_enabled():
        raise
    return None


# ---------------------------------------------------------------- forecasts --
_FC_SQL = """
select f.sku_id as product_id, f.target_date as date, f.store_id, f.horizon,
       f.p10_demand as p10, f.p50_demand as p50, f.p90_demand as p90,
       f.incumbent_forecast as incumbent, f.actual_demand as actual, f.model_version
from daily_forecasts f
left join skus s using (sku_id)
order by coalesce(s.rank_order, 2147483647), sku_id, target_date
"""


def load_forecasts() -> pd.DataFrame:
    if _use_db():
        try:
            df = db.query_df(_FC_SQL)
            if not df.empty:
                for c in ("p10", "p50", "p90", "incumbent", "actual"):
                    df[c] = pd.to_numeric(df[c], errors="coerce")
                df["date"] = pd.to_datetime(df["date"]).dt.strftime("%Y-%m-%d")
                df["store_id"] = df["store_id"].fillna(STORE_ID_DEFAULT)
                return df
        except db.DBUnavailable as e:
            _fallback(e)
    return pd.read_parquet(os.path.join(DATA_DIR, "forecasts.parquet"))


_LT_SQL = """
select l.sku_id as product_id, l.origin_date, l.store_id, l.protection_days,
       l.p10_lt, l.p50_lt, l.p90_lt
from leadtime_forecasts l
left join skus s using (sku_id)
order by coalesce(s.rank_order, 2147483647), l.sku_id
"""


def load_forecasts_lt() -> pd.DataFrame:
    if _use_db():
        try:
            df = db.query_df(_LT_SQL)
            if not df.empty:
                for c in ("protection_days", "p10_lt", "p50_lt", "p90_lt"):
                    df[c] = pd.to_numeric(df[c], errors="coerce")
                df["origin_date"] = pd.to_datetime(df["origin_date"]).dt.strftime("%Y-%m-%d")
                return df
        except db.DBUnavailable as e:
            _fallback(e)
    return pd.read_parquet(os.path.join(DATA_DIR, "forecasts_lt.parquet"))


# ---------------------------------------------------------- recommendations --
_REC_SQL = """
select p.rec_id, p.sku_id, p.store_id, p.decision_date, p.status,
       p.ai_recommended_qty, p.ai_guardrail_flags, p.on_hand, p.reorder_point,
       p.safety_stock, p.service_level, p.days_to_stockout, p.stockout_risk_7d,
       p.cost_if_ignored, p.cost_of_action, p.net_benefit, p.rationale,
       p.evidence, p.proposer, p.verification, p.human_approved_qty
from purchase_orders p
left join skus s using (sku_id)
order by coalesce(s.rank_order, 2147483647), rec_id
"""

# Postgres holds the workflow vocabulary; the UI speaks the original one.
_STATUS_TO_APP = {"PENDING_APPROVAL": "pending", "APPROVED": "approved",
                  "REJECTED": "rejected", "EXECUTED": "executed"}
_STATUS_TO_DB = {v: k for k, v in _STATUS_TO_APP.items()}


def _f(v, default=0.0):
    try:
        return default if v is None else float(v)
    except (TypeError, ValueError):
        return default


def _int_if_whole(v, default=0):
    """NUMERIC comes back as float; the file version stored some of these as
    ints. Match that so the UI does not start printing "7.0 days"."""
    f = _f(v, default)
    return int(f) if float(f).is_integer() else f


def load_recommendations() -> list[dict]:
    if _use_db():
        try:
            rows = db.query(_REC_SQL)
            if rows:
                out = []
                for r in rows:
                    d = r.get("decision_date")
                    out.append({
                        "rec_id": r["rec_id"],
                        "product_id": r["sku_id"],
                        "seller_id": r["sku_id"],
                        "store_id": r.get("store_id") or STORE_ID_DEFAULT,
                        "date": d.isoformat() if hasattr(d, "isoformat") else (d or ""),
                        "status": _STATUS_TO_APP.get(r.get("status"), "pending"),
                        "recommended_qty": _f(r.get("ai_recommended_qty")),
                        "guardrail_flags": r.get("ai_guardrail_flags") or [],
                        "on_hand": _f(r.get("on_hand")),
                        "reorder_point": _f(r.get("reorder_point")),
                        "safety_stock": _f(r.get("safety_stock")),
                        "service_level": _f(r.get("service_level")),
                        "days_to_stockout": _int_if_whole(r.get("days_to_stockout")),
                        "stockout_risk_7d": _f(r.get("stockout_risk_7d")),
                        "cost_if_ignored": _f(r.get("cost_if_ignored")),
                        "cost_of_action": _f(r.get("cost_of_action")),
                        "net_benefit": _f(r.get("net_benefit")),
                        "rationale": r.get("rationale") or "",
                        "evidence": r.get("evidence") or {},
                        "proposer": r.get("proposer") or {},
                        "verification": r.get("verification") or {},
                    })
                return out
        except db.DBUnavailable as e:
            _fallback(e)
    with open(os.path.join(DATA_DIR, "recommendations.json")) as f:
        return json.load(f)


def save_recommendations(recs: list[dict]) -> None:
    """Persist approve/reject decisions. Writes to Postgres when available and
    always keeps the JSON file in step, so a fallback read stays truthful."""
    if _use_db():
        try:
            db.execute_many(
                """update purchase_orders
                      set status = %s, human_approved_qty = %s,
                          reviewed_at = case when %s <> 'PENDING_APPROVAL'
                                             then now() else reviewed_at end
                    where rec_id = %s""",
                [(_STATUS_TO_DB.get(r.get("status"), "PENDING_APPROVAL"),
                  int(r["recommended_qty"]) if r.get("recommended_qty") is not None else None,
                  _STATUS_TO_DB.get(r.get("status"), "PENDING_APPROVAL"),
                  r.get("rec_id")) for r in recs],
            )
        except db.DBUnavailable as e:
            _fallback(e)
    path = os.path.join(DATA_DIR, "recommendations.json")
    if os.path.isdir(os.path.dirname(path)):
        with open(path, "w") as f:
            json.dump(recs, f, indent=2)


# -------------------------------------------------------------- simulation --
_SIM_SQL = """
select cost_a_current, cost_b_incumbent, cost_c_stockpilot, system_lift,
       forecast_lift, forecast_lift_pct_ma, assumptions
from simulation_runs order by run_id desc limit 1
"""


def load_simulation_results() -> dict:
    if _use_db():
        try:
            rows = db.query(_SIM_SQL)
            if rows:
                r = rows[0]
                return {
                    "totals": {
                        "A_current_practice": _f(r.get("cost_a_current")),
                        "B_incumbent_forecast": _f(r.get("cost_b_incumbent")),
                        "C_stockpilot": _f(r.get("cost_c_stockpilot")),
                    },
                    "C_vs_A_system_lift": r.get("system_lift") or {},
                    "C_vs_B_forecast_lift": r.get("forecast_lift") or {},
                    "forecast_lift_pct_vs_MA": _f(r.get("forecast_lift_pct_ma")),
                    "assumptions": r.get("assumptions") or {},
                }
        except db.DBUnavailable as e:
            _fallback(e)
    path = os.path.join(DATA_DIR, "simulation_results.json")
    if not os.path.exists(path):
        return {}
    with open(path) as f:
        return json.load(f)


# --------------------------------------------------------- backtest metrics --
def load_backtest_metrics(pipeline: str = "retail") -> pd.DataFrame:
    """One row per rolling-origin fold, metrics flattened back into columns."""
    if _use_db():
        try:
            rows = db.query(
                "select fold, metrics from backtest_metrics where pipeline = %s order by fold",
                (pipeline,))
            if rows:
                return pd.DataFrame([{"fold": r["fold"], **(r["metrics"] or {})} for r in rows])
        except db.DBUnavailable as e:
            _fallback(e)
    path = os.path.join(DATA_DIR, "backtest_metrics.csv")
    return pd.read_csv(path) if os.path.exists(path) else pd.DataFrame()


# -------------------------------------------------------------- audit trail --
AUDIT_LOG_PATH = os.path.join(DATA_DIR, "audit_log.json")

_AUDIT_SQL = """
select entity_id, action, actor_name, actor_type, details, payload, "timestamp"
from system_audit_trace order by "timestamp" desc, trace_id desc limit %s
"""


def load_audit_log(limit: int = 500) -> list[dict]:
    if _use_db():
        try:
            rows = db.query(_AUDIT_SQL, (limit,))
            if rows:
                out = []
                for r in rows:
                    p = r.get("payload") or {}
                    ts = r.get("timestamp")
                    out.append({
                        "rec_id": r.get("entity_id"),
                        "action": r.get("action"),
                        "approver": p.get("approver") or r.get("actor_name"),
                        "actor_type": r.get("actor_type"),
                        "note": (p.get("note") or r.get("details")) or None,
                        "qty": p.get("qty"),
                        "timestamp": ts.isoformat() if hasattr(ts, "isoformat") else ts,
                    })
                return out
        except db.DBUnavailable as e:
            _fallback(e)
    if not os.path.exists(AUDIT_LOG_PATH):
        return []
    with open(AUDIT_LOG_PATH) as f:
        return json.load(f)


def append_audit_entry(entry: dict) -> None:
    if _use_db():
        try:
            db.execute(
                """insert into system_audit_trace
                     (entity_id, entity_type, actor_type, actor_name, action,
                      details, "timestamp", payload)
                   values (%s, 'PURCHASE_ORDER', 'HUMAN', %s, %s, %s,
                           coalesce(%s::timestamptz, now()), %s::jsonb)""",
                (entry.get("rec_id"), entry.get("approver") or "planner",
                 entry.get("action"), entry.get("note") or "",
                 entry.get("timestamp"), json.dumps(
                     {k: entry.get(k) for k in ("qty", "note", "approver")})),
            )
            return
        except db.DBUnavailable as e:
            _fallback(e)
    if not os.path.isdir(os.path.dirname(AUDIT_LOG_PATH)):
        return
    log = load_audit_log() if os.path.exists(AUDIT_LOG_PATH) else []
    log.append(entry)
    with open(AUDIT_LOG_PATH, "w") as f:
        json.dump(log, f, indent=2)


# ------------------------------------------------------------------ status --
def source() -> dict:
    """What the API is actually reading from right now."""
    st = db.status()
    return {"source": "postgres" if st["connected"] else "files",
            "database": st,
            "data_dir": DATA_DIR}
