"""
CSV -> DuckDB loader for the real Olist e-commerce dataset (9 CSVs).

Loads each of the 9 Olist CSVs into a DuckDB file (olist.duckdb) as tables:
orders, order_items, order_payments, order_reviews, products, sellers,
customers, geolocation, category_translation.

This is the real-data replacement for the Day-1 mock/scaffold pipeline that
was built against the synthetic Kaggle `retail_store_inventory.csv`
(src/data/loader.py, src/data/quality.py). Those files are left in place for
reference but are no longer the active data path.
"""
from __future__ import annotations

import os
import duckdb

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
RAW_DIR_DEFAULT = os.path.join(REPO_ROOT, "data", "raw")
DUCKDB_PATH_DEFAULT = os.path.join(REPO_ROOT, "olist.duckdb")

# table_name -> (csv filename, expected approx row count)
TABLES = {
    "orders": ("olist_orders_dataset.csv", 99_441),
    "order_items": ("olist_order_items_dataset.csv", 112_650),
    "order_payments": ("olist_order_payments_dataset.csv", 103_886),
    "order_reviews": ("olist_order_reviews_dataset.csv", 99_224),
    "products": ("olist_products_dataset.csv", 32_951),
    "sellers": ("olist_sellers_dataset.csv", 3_095),
    "customers": ("olist_customers_dataset.csv", 99_441),
    "geolocation": ("olist_geolocation_dataset.csv", 1_000_163),
    "category_translation": ("product_category_name_translation.csv", 71),
}


def load_to_duckdb(raw_dir: str = RAW_DIR_DEFAULT, db_path: str = DUCKDB_PATH_DEFAULT) -> dict[str, int]:
    """Load all 9 Olist CSVs into `db_path` as DuckDB tables. Returns row counts per table."""
    con = duckdb.connect(db_path)
    counts: dict[str, int] = {}
    try:
        for table, (csv_name, _expected) in TABLES.items():
            csv_path = os.path.join(raw_dir, csv_name)
            if not os.path.exists(csv_path):
                raise FileNotFoundError(f"Missing required CSV for table '{table}': {csv_path}")
            con.execute(
                f"CREATE OR REPLACE TABLE {table} AS "
                f"SELECT * FROM read_csv_auto(?, header=true, sample_size=-1)",
                [csv_path],
            )
            counts[table] = con.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
    finally:
        con.close()
    return counts


def _report(counts: dict[str, int]) -> None:
    print(f"{'table':<20}{'rows':>12}{'expected~':>14}{'status':>10}")
    for table, (_csv, expected) in TABLES.items():
        actual = counts[table]
        # "roughly match" tolerance: within 1% of the expected count
        ok = abs(actual - expected) <= max(1, round(expected * 0.01))
        print(f"{table:<20}{actual:>12}{expected:>14}{'OK' if ok else 'CHECK':>10}")


if __name__ == "__main__":
    counts = load_to_duckdb()
    _report(counts)
    print(f"\nLoaded into {DUCKDB_PATH_DEFAULT}")
