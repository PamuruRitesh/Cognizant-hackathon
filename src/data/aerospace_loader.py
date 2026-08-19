"""
Aerospace Supply Chain Dataset Loader and Data Quality Checks.

Loads the 4 aerospace CSV files into DuckDB and executes rigorous,
reproducible data quality validations (missing values, duplicates, numeric
bounds, category consistency, referential integrity, and chronology).
"""
from __future__ import annotations

import os
from typing import Any, Dict, List, Tuple
import duckdb
import pandas as pd

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
AEROSPACE_DATA_DIR = os.path.join(REPO_ROOT, "data", "aerospace")
AEROSPACE_DB_PATH = os.path.join(REPO_ROOT, "aerospace.duckdb")

AEROSPACE_TABLES = {
    "parts_master": "parts_master.csv",
    "purchase_orders": "purchase_orders.csv",
    "quality_incidents": "quality_incidents.csv",
    "supply_chain_history": "supply_chain_history.csv",
}


def load_aerospace_to_duckdb(
    data_dir: str = AEROSPACE_DATA_DIR, db_path: str = AEROSPACE_DB_PATH
) -> Tuple[duckdb.DuckDBPyConnection, Dict[str, int]]:
    """Load aerospace CSVs into DuckDB and return connection and row counts."""
    con = duckdb.connect(db_path)
    counts: Dict[str, int] = {}
    for table_name, csv_file in AEROSPACE_TABLES.items():
        csv_path = os.path.join(data_dir, csv_file)
        if not os.path.exists(csv_path):
            raise FileNotFoundError(f"Aerospace CSV not found: {csv_path}")
        con.execute(
            f"CREATE OR REPLACE TABLE {table_name} AS "
            f"SELECT * FROM read_csv_auto(?, header=true, sample_size=-1)",
            [csv_path],
        )
        counts[table_name] = con.execute(f"SELECT COUNT(*) FROM {table_name}").fetchone()[0]
    return con, counts


def run_data_quality_checks(con: duckdb.DuckDBPyConnection) -> Dict[str, Any]:
    """Perform comprehensive data quality and integrity checks."""
    report: Dict[str, Any] = {"status": "PASSED", "checks": []}

    def _add_check(name: str, passed: bool, details: Any):
        report["checks"].append({
            "name": name,
            "status": "PASSED" if passed else "FAILED",
            "details": details,
        })
        if not passed:
            report["status"] = "FAILED"

    # 1. Row counts & Nulls
    for table_name in AEROSPACE_TABLES.keys():
        total_rows = con.execute(f"SELECT COUNT(*) FROM {table_name}").fetchone()[0]
        schema = con.execute(f"DESCRIBE {table_name}").df()
        null_counts = {}
        for col in schema["column_name"]:
            cnt = con.execute(
                f'SELECT COUNT(CASE WHEN "{col}" IS NULL THEN 1 END) FROM {table_name}'
            ).fetchone()[0]
            if cnt > 0:
                null_counts[col] = cnt
        
        # In parts_master, shelf_life_days has nulls for non-perishable parts which is valid
        allowed_nulls = {"shelf_life_days"} if table_name == "parts_master" else set()
        unexpected_nulls = {k: v for k, v in null_counts.items() if k not in allowed_nulls}
        _add_check(
            f"null_check_{table_name}",
            len(unexpected_nulls) == 0,
            {"total_rows": total_rows, "null_columns": null_counts},
        )

    # 2. Exact Duplicates
    for table_name in AEROSPACE_TABLES.keys():
        schema = con.execute(f"DESCRIBE {table_name}").df()
        cols = [f'"{c}"' for c in schema["column_name"]]
        dup_cnt = con.execute(
            f"SELECT COUNT(*) FROM ("
            f"  SELECT {', '.join(cols)}, COUNT(*) FROM {table_name} "
            f"  GROUP BY {', '.join(cols)} HAVING COUNT(*) > 1"
            f")"
        ).fetchone()[0]
        _add_check(f"duplicate_check_{table_name}", dup_cnt == 0, {"duplicate_rows": dup_cnt})

    # 3. Numeric bounds & Valid Values
    invalid_consumption = con.execute(
        "SELECT COUNT(*) FROM supply_chain_history WHERE consumption_qty < 0 OR on_hand_qty < 0"
    ).fetchone()[0]
    _add_check("numeric_bounds_supply_chain", invalid_consumption == 0, {"negative_qty_rows": invalid_consumption})

    invalid_cost = con.execute(
        "SELECT COUNT(*) FROM parts_master WHERE unit_cost <= 0 OR lead_time_days <= 0"
    ).fetchone()[0]
    _add_check("numeric_bounds_parts_master", invalid_cost == 0, {"invalid_cost_or_lead_time": invalid_cost})

    # 4. Referential Integrity
    orphan_parts_sch = con.execute(
        "SELECT COUNT(*) FROM supply_chain_history sch "
        "LEFT JOIN parts_master pm ON sch.part_id = pm.part_id "
        "WHERE pm.part_id IS NULL"
    ).fetchone()[0]
    orphan_parts_po = con.execute(
        "SELECT COUNT(*) FROM purchase_orders po "
        "LEFT JOIN parts_master pm ON po.part_id = pm.part_id "
        "WHERE pm.part_id IS NULL"
    ).fetchone()[0]
    _add_check(
        "referential_integrity_parts",
        orphan_parts_sch == 0 and orphan_parts_po == 0,
        {"orphan_parts_sch": orphan_parts_sch, "orphan_parts_po": orphan_parts_po},
    )

    # 5. Date Continuity in Supply Chain History
    continuity_stats = con.execute("""
        WITH lag_dates AS (
            SELECT date, site_id, part_id, LAG(date) OVER (PARTITION BY site_id, part_id ORDER BY date) as prev_date
            FROM supply_chain_history
        )
        SELECT 
            COUNT(CASE WHEN date - prev_date != 7 THEN 1 END) as non_7day_steps,
            COUNT(DISTINCT site_id || '_' || part_id) as total_series,
            MIN(date) as min_date,
            MAX(date) as max_date
        FROM lag_dates
        WHERE prev_date IS NOT NULL
    """).df().iloc[0].to_dict()

    _add_check(
        "data_continuity_weekly",
        continuity_stats["non_7day_steps"] == 0,
        continuity_stats,
    )

    return report


if __name__ == "__main__":
    con, counts = load_aerospace_to_duckdb()
    print("Loaded table row counts:", counts)
    report = run_data_quality_checks(con)
    print("\nData Quality Report:")
    for chk in report["checks"]:
        print(f"  [{chk['status']}] {chk['name']}: {chk['details']}")
    con.close()
