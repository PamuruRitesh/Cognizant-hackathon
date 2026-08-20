-- StockPilot base schema (the 8 tables agreed with the database owner).
-- Written idempotently so it is safe to re-run. If the tables already exist
-- in Neon, this file is a no-op and only 02_schema_extension.sql matters.

CREATE TABLE IF NOT EXISTS stores (
    store_id    TEXT PRIMARY KEY,
    store_name  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS skus (
    sku_id            TEXT PRIMARY KEY,
    store_id          TEXT REFERENCES stores(store_id),
    product_category  TEXT,
    current_stock     INTEGER,
    unit_cost         NUMERIC(12,2),
    lead_time_days    INTEGER
);

CREATE TABLE IF NOT EXISTS inventory_history (
    sku_id          TEXT REFERENCES skus(sku_id),
    recorded_date   DATE,
    opening_stock   INTEGER,
    units_sold      INTEGER,
    units_received  INTEGER,
    closing_stock   INTEGER,
    PRIMARY KEY (sku_id, recorded_date)
);

CREATE TABLE IF NOT EXISTS daily_forecasts (
    sku_id               TEXT REFERENCES skus(sku_id),
    target_date          DATE,
    p10_demand           NUMERIC(12,3),
    p50_demand           NUMERIC(12,3),
    p90_demand           NUMERIC(12,3),
    stockout_risk_score  NUMERIC(6,4),
    PRIMARY KEY (sku_id, target_date)
);

CREATE TABLE IF NOT EXISTS users (
    user_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email          TEXT UNIQUE NOT NULL,
    role           TEXT NOT NULL,
    password_hash  TEXT,
    created_at     TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS purchase_orders (
    po_id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sku_id              TEXT REFERENCES skus(sku_id),
    status              TEXT NOT NULL,
    ai_recommended_qty  INTEGER,
    ai_guardrail_flags  JSONB,
    ai_drafted_at       TIMESTAMPTZ,
    human_approved_qty  INTEGER,
    reviewer_user_id    UUID REFERENCES users(user_id),
    human_feedback      TEXT,
    reviewed_at         TIMESTAMPTZ,
    executed_at         TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS llm_audit_logs (
    log_id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    po_id                 UUID REFERENCES purchase_orders(po_id),
    model_version         TEXT,
    input_prompt_context  JSONB,
    generated_rationale   TEXT,
    prompt_tokens         INTEGER,
    completion_tokens     INTEGER
);

CREATE TABLE IF NOT EXISTS system_audit_trace (
    trace_id     BIGSERIAL PRIMARY KEY,
    entity_id    TEXT,
    entity_type  TEXT,
    actor_type   TEXT,
    actor_name   TEXT,
    action       TEXT,
    details      TEXT,
    "timestamp"  TIMESTAMPTZ
);
