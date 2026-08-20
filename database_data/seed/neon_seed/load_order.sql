-- Load in this order (respects foreign keys). Run in psql / Neon SQL editor.
-- Uses \copy so paths are client-side. Adjust the path prefix as needed.

\copy stores (store_id, store_name) FROM '01_stores.csv' WITH (FORMAT csv, HEADER true, NULL '');
\copy skus (sku_id, store_id, product_category, current_stock, unit_cost, lead_time_days) FROM '02_skus.csv' WITH (FORMAT csv, HEADER true, NULL '');
\copy inventory_history (sku_id, recorded_date, opening_stock, units_sold, units_received, closing_stock) FROM '03_inventory_history.csv' WITH (FORMAT csv, HEADER true, NULL '');
\copy daily_forecasts (sku_id, target_date, p10_demand, p50_demand, p90_demand, stockout_risk_score) FROM '04_daily_forecasts.csv' WITH (FORMAT csv, HEADER true, NULL '');
\copy users (user_id, email, display_name, role, password_hash, is_active) FROM '05_users.csv' WITH (FORMAT csv, HEADER true, NULL '');
\copy purchase_orders (po_id, sku_id, status, ai_recommended_qty, ai_guardrail_flags, ai_drafted_at, human_approved_qty, reviewer_user_id, human_feedback, reviewed_at, executed_at) FROM '06_purchase_orders.csv' WITH (FORMAT csv, HEADER true, NULL '');
\copy llm_audit_logs (log_id, po_id, model_version, input_prompt_context, generated_rationale, prompt_tokens, completion_tokens) FROM '07_llm_audit_logs.csv' WITH (FORMAT csv, HEADER true, NULL '');
\copy system_audit_trace (entity_id, entity_type, actor_type, actor_name, action, details, timestamp) FROM '08_system_audit_trace.csv' WITH (FORMAT csv, HEADER true, NULL '');
