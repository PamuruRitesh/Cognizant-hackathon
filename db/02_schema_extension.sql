-- StockPilot schema extension.
--
-- The 8 base tables cover inventory and the approval workflow, but the API also
-- serves forecast accuracy, protection-interval quantiles, the decision
-- economics behind each PO, and the three-arm simulation. Those have no home in
-- the base schema, so every one of those endpoints would still be reading files.
-- This file adds what is missing. All statements are additive and idempotent.

-- ---------------------------------------------------------------------------
-- 1. daily_forecasts needs the columns the accuracy KPIs and fan charts use.
--    incumbent = the baseline forecast we beat; actual = what really happened.
-- ---------------------------------------------------------------------------
ALTER TABLE daily_forecasts ADD COLUMN IF NOT EXISTS store_id            TEXT;
ALTER TABLE daily_forecasts ADD COLUMN IF NOT EXISTS horizon             INTEGER;
ALTER TABLE daily_forecasts ADD COLUMN IF NOT EXISTS incumbent_forecast  NUMERIC(12,3);
ALTER TABLE daily_forecasts ADD COLUMN IF NOT EXISTS actual_demand       NUMERIC(12,3);
ALTER TABLE daily_forecasts ADD COLUMN IF NOT EXISTS model_version       TEXT;

-- ---------------------------------------------------------------------------
-- 2. purchase_orders needs the inventory maths and economics that justify it.
--    Without these the Approval Queue cannot show why a PO was drafted.
-- ---------------------------------------------------------------------------
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS rec_id           TEXT;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS store_id         TEXT;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS decision_date    DATE;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS on_hand          NUMERIC(12,3);
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS reorder_point    NUMERIC(12,3);
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS safety_stock     NUMERIC(12,3);
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS service_level    NUMERIC(6,4);
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS days_to_stockout NUMERIC(10,3);
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS stockout_risk_7d NUMERIC(6,4);
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS cost_if_ignored  NUMERIC(14,4);
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS cost_of_action   NUMERIC(14,4);
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS net_benefit      NUMERIC(14,4);
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS rationale        TEXT;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS evidence         JSONB;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS proposer         JSONB;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS verification     JSONB;

CREATE UNIQUE INDEX IF NOT EXISTS purchase_orders_rec_id_key ON purchase_orders (rec_id);

-- ---------------------------------------------------------------------------
-- 2b. Preserve the pipeline's own row order, so the API returns rows in the
--     same sequence the file-based version did. Without this, Postgres is free
--     to return any order and the dashboard lists reshuffle.
-- ---------------------------------------------------------------------------
ALTER TABLE skus ADD COLUMN IF NOT EXISTS rank_order INTEGER;

-- ---------------------------------------------------------------------------
-- 3. Lead-time (protection interval) quantiles. These are NOT the sum of the
--    daily quantiles -- quantiles are not additive -- so they are stored, not
--    derived. This is what the reorder point is actually built from.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS leadtime_forecasts (
    sku_id          TEXT REFERENCES skus(sku_id),
    origin_date     DATE,
    store_id        TEXT,
    protection_days NUMERIC(8,3),
    p10_lt          NUMERIC(14,4),
    p50_lt          NUMERIC(14,4),
    p90_lt          NUMERIC(14,4),
    PRIMARY KEY (sku_id, origin_date)
);

-- ---------------------------------------------------------------------------
-- 4. Backtest metrics, one row per rolling-origin fold. Backs the accuracy KPIs.
--    Kept as JSONB because the metric set differs between the retail and
--    aerospace pipelines and we do not want a migration every time one changes.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS backtest_metrics (
    id           BIGSERIAL PRIMARY KEY,
    pipeline     TEXT NOT NULL DEFAULT 'retail',
    fold         TEXT NOT NULL,
    metrics      JSONB NOT NULL,
    computed_at  TIMESTAMPTZ DEFAULT now(),
    UNIQUE (pipeline, fold)
);

-- ---------------------------------------------------------------------------
-- 5. Simulation runs -- the three-arm cost comparison. One row per run so a
--    re-run does not destroy the previous result and the demo stays reproducible.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS simulation_runs (
    run_id                 BIGSERIAL PRIMARY KEY,
    run_label              TEXT UNIQUE NOT NULL,
    pipeline               TEXT NOT NULL DEFAULT 'retail',
    cost_a_current         NUMERIC(16,4),
    cost_b_incumbent       NUMERIC(16,4),
    cost_c_stockpilot      NUMERIC(16,4),
    system_lift            JSONB,
    forecast_lift          JSONB,
    forecast_lift_pct_ma   NUMERIC(10,4),
    assumptions            JSONB,
    created_at             TIMESTAMPTZ DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 6. system_audit_trace needs a payload for the human-approval details the
--    file-based audit log carried (approved qty, reviewer note).
-- ---------------------------------------------------------------------------
ALTER TABLE system_audit_trace ADD COLUMN IF NOT EXISTS payload JSONB;

-- ---------------------------------------------------------------------------
-- Indexes for the read patterns the API actually uses.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_forecasts_date      ON daily_forecasts (target_date);
CREATE INDEX IF NOT EXISTS idx_forecasts_sku_date  ON daily_forecasts (sku_id, target_date);
CREATE INDEX IF NOT EXISTS idx_inv_hist_date       ON inventory_history (recorded_date);
CREATE INDEX IF NOT EXISTS idx_po_status           ON purchase_orders (status);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp     ON system_audit_trace ("timestamp" DESC);
CREATE INDEX IF NOT EXISTS idx_llm_po              ON llm_audit_logs (po_id);
