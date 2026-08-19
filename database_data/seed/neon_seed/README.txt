STOCKPILOT — NEON/POSTGRES SEED DATA
=====================================
Generated from the live pipeline artifacts. Load the CSVs in the numbered
order (they respect the foreign keys). Each file's header matches the table
columns; UUIDs are pre-generated so references line up.

HOW TO LOAD (psql or Neon SQL editor):
  1. Run the schema (your CREATE TABLE script) first.
  2. From the folder containing the CSVs, run the commands in load_order.sql,
     or use \copy per file, e.g.:
       \copy stores (store_id, store_name) FROM '01_stores.csv' WITH (FORMAT csv, HEADER true, NULL '');
  (Neon web editor: use its CSV import per table, in the numbered order.)

TABLE  ->  SOURCE  (row count)
  1 stores              1    single marketplace ("OLIST-BR")
  2 skus               50    the 50 active sellers we forecast (product_id = seller_id)
  3 inventory_history  ~20k  real daily units_sold per SKU (for ML history)
  4 daily_forecasts    700   LightGBM P10/P50/P90 + stockout risk (50 SKUs x 14 days)
  5 users               2    one PLANNER, one ADMIN (for approvals)
  6 purchase_orders     50   the AI-drafted POs (our recommendations)
  7 llm_audit_logs      50   Grok rationale + evidence context per PO
  8 system_audit_trace 100   AI drafted + Verifier acted, per PO

HONEST CAVEATS (say these if asked):
  - product_category = "General Merchandise": Olist sellers span many
    categories, so we don't carry one category per SKU. Replace if you map it.
  - inventory_history opening_stock / units_received / closing_stock = 0:
    Olist is a MARKETPLACE with no stock ledger. units_sold is real; the
    other columns are placeholders (the ML only needs units_sold).
  - purchase_orders: our "escalated" status maps to PENDING_APPROVAL (the
    schema has no ESCALATED state — it still needs a human).
  - llm_audit_logs prompt_tokens / completion_tokens are empty (NULL):
    token counts are captured in Langfuse, not stored in the JSON artifacts.
  - The two user_ids in 05_users.csv are the ones to use as reviewer_user_id
    when you wire up approvals.

REGENERATE: python scripts/export_neon_seed.py   (after `make plan`)
