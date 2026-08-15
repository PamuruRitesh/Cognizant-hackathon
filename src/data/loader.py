"""
CSV -> DuckDB loader for retail_store_inventory.csv (Kaggle: Retail Store
Inventory and Demand Forecasting).

Expected columns (15):
Date, Store ID, Product ID, Category, Region, Inventory Level, Units Sold,
Units Ordered, Demand Forecast, Price, Discount, Weather Condition,
Holiday/Promotion, Competitor Pricing, Seasonality
"""
from __future__ import annotations

import os
import duckdb
import pandas as pd

RAW_CSV_DEFAULT = os.path.join(
    os.path.dirname(__file__), "..", "..", "data", "raw", "retail_store_inventory.csv"
)
DUCKDB_PATH_DEFAULT = os.path.join(
    os.path.dirname(__file__), "..", "..", "data", "stockpilot.duckdb"
)

RENAME_MAP = {
    "Date": "date",
    "Store ID": "store_id",
    "Product ID": "product_id",
    "Category": "category",
    "Region": "region",
    "Inventory Level": "inventory_level",
    "Units Sold": "units_sold",
    "Units Ordered": "units_ordered",
    "Demand Forecast": "incumbent",  # NEVER use as a model feature — see CONTRACTS.md
    "Price": "price",
    "Discount": "discount",
    "Weather Condition": "weather",
    "Holiday/Promotion": "holiday_promo",
    "Competitor Pricing": "competitor_price",
    "Seasonality": "seasonality",
}

TRAIN_END = "2023-06-30"
VAL_END = "2023-09-30"
TEST_END = "2024-01-01"


def load_raw(csv_path: str = RAW_CSV_DEFAULT) -> pd.DataFrame:
    df = pd.read_csv(csv_path)
    df = df.rename(columns=RENAME_MAP)
    df["date"] = pd.to_datetime(df["date"])
    df = df.sort_values(["store_id", "product_id", "date"]).reset_index(drop=True)
    return df


def load_to_duckdb(csv_path: str = RAW_CSV_DEFAULT, db_path: str = DUCKDB_PATH_DEFAULT) -> None:
    df = load_raw(csv_path)
    os.makedirs(os.path.dirname(db_path), exist_ok=True)
    con = duckdb.connect(db_path)
    con.execute("CREATE OR REPLACE TABLE inventory_daily AS SELECT * FROM df")
    con.close()


def time_split(df: pd.DataFrame) -> dict[str, pd.DataFrame]:
    """Lock this Day 1, never change it. Test window is touched only on Day 3+."""
    train = df[df["date"] <= TRAIN_END]
    val = df[(df["date"] > TRAIN_END) & (df["date"] <= VAL_END)]
    test = df[(df["date"] > VAL_END) & (df["date"] <= TEST_END)]
    return {"train": train, "val": val, "test": test}


if __name__ == "__main__":
    load_to_duckdb()
    print(f"Loaded into {DUCKDB_PATH_DEFAULT}")
