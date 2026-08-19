-- Load in this order (respects foreign keys). Run in psql or the Neon SQL editor.
-- Requires db/01_schema_base.sql and db/02_schema_extension.sql to have run first.
-- \copy is client-side, so run it from inside the neon_seed/ folder.

\copy stores (store_id, store_name) FROM '01_stores.csv' WITH (FORMAT csv, HEADER true, NULL '');
\copy skus (sku_id, store_id, product_category, current_stock, unit_cost, lead_time_days, rank_order) FROM '02_skus.csv' WITH (FORMAT csv, HEADER true, NULL '');
\copy inventory_history (sku_id, recorded_date, opening_stock, units_sold, units_received, closing_stock) FROM '03_inventory_history.csv' WITH (FORMAT csv, HEADER true, NULL '');
\copy daily_forecasts (sku_id, target_date, p10_demand, p50_demand, p90_demand, stockout_risk_score, store_id, horizon, incumbent_forecast, actual_demand, model_version) FROM '04_daily_forecasts.csv' WITH (FORMAT csv, HEADER true, NULL '');
\copy users (user_id, email, role) FROM '05_users.csv' WITH (FORMAT csv, HEADER true, NULL '');
\copy purchase_orders (po_id, sku_id, status, ai_recommended_qty, ai_guardrail_flags, ai_drafted_at, human_approved_qty, reviewer_user_id, human_feedback, reviewed_at, executed_at, rec_id, store_id, decision_date, on_hand, reorder_point, safety_stock, service_level, days_to_stockout, stockout_risk_7d, cost_if_ignored, cost_of_action, net_benefit, rationale, evidence, proposer, verification) FROM '06_purchase_orders.csv' WITH (FORMAT csv, HEADER true, NULL '');
\copy llm_audit_logs (log_id, po_id, model_version, input_prompt_context, generated_rationale, prompt_tokens, completion_tokens) FROM '07_llm_audit_logs.csv' WITH (FORMAT csv, HEADER true, NULL '');
\copy system_audit_trace (entity_id, entity_type, actor_type, actor_name, action, details, timestamp, payload) FROM '08_system_audit_trace.csv' WITH (FORMAT csv, HEADER true, NULL '');
\copy leadtime_forecasts (sku_id, origin_date, store_id, protection_days, p10_lt, p50_lt, p90_lt) FROM '09_leadtime_forecasts.csv' WITH (FORMAT csv, HEADER true, NULL '');
\copy backtest_metrics (pipeline, fold, metrics) FROM '10_backtest_metrics.csv' WITH (FORMAT csv, HEADER true, NULL '');
\copy simulation_runs (run_label, pipeline, cost_a_current, cost_b_incumbent, cost_c_stockpilot, system_lift, forecast_lift, forecast_lift_pct_ma, assumptions) FROM '11_simulation_runs.csv' WITH (FORMAT csv, HEADER true, NULL '');
