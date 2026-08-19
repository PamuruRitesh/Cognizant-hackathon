import os
import duckdb
import pandas as pd

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DATA_DIR = os.path.join(REPO_ROOT, "data", "aerospace")
DB_PATH = os.path.join(REPO_ROOT, "aerospace.duckdb")

con = duckdb.connect(DB_PATH)

files = [f for f in os.listdir(DATA_DIR) if f.endswith(".csv")]
print(f"Found files in {DATA_DIR}: {files}\n")

for f in sorted(files):
    tbl_name = f.replace(".csv", "")
    csv_path = os.path.join(DATA_DIR, f)
    con.execute(f"CREATE OR REPLACE TABLE {tbl_name} AS SELECT * FROM read_csv_auto(?, header=true, sample_size=-1)", [csv_path])
    row_count = con.execute(f"SELECT COUNT(*) FROM {tbl_name}").fetchone()[0]
    schema = con.execute(f"DESCRIBE {tbl_name}").df()
    print(f"==================================================")
    print(f"TABLE: {tbl_name} (File: {f})")
    print(f"Row count: {row_count}")
    print(f"Columns ({len(schema)}):")
    for _, r in schema.iterrows():
        print(f"  {r['column_name']:<30} : {r['column_type']}")
    
    # Missing values check
    null_checks = []
    for col in schema['column_name']:
        null_checks.append(f'COUNT(CASE WHEN "{col}" IS NULL THEN 1 END) AS "{col}"')
    null_sql = f"SELECT {', '.join(null_checks)} FROM {tbl_name}"
    null_df = con.execute(null_sql).df()
    print("\nMissing values per column:")
    for col in null_df.columns:
        cnt = null_df[col].iloc[0]
        if cnt > 0:
            print(f"  {col}: {cnt} nulls ({cnt/row_count*100:.2f}%)")
    if (null_df.iloc[0] == 0).all():
        print("  None (0 missing values across all columns)")

    # Duplicates check
    cols_quoted = [f'"{c}"' for c in schema['column_name']]
    dup_sql = f"SELECT COUNT(*) FROM (SELECT {', '.join(cols_quoted)}, COUNT(*) FROM {tbl_name} GROUP BY {', '.join(cols_quoted)} HAVING COUNT(*) > 1)"
    dup_count = con.execute(dup_sql).fetchone()[0]
    print(f"\nExact duplicate rows: {dup_count}")

    print("==================================================\n")

print("\n--- RELATIONSHIP & ENTITY ANALYSIS ---")
# Let's inspect supply_chain_history table specifically
history_schema = con.execute("DESCRIBE supply_chain_history").df()
print("supply_chain_history columns:", history_schema['column_name'].tolist())

# Sample rows
print("\nSample 3 rows of supply_chain_history:")
print(con.execute("SELECT * FROM supply_chain_history LIMIT 3").df().to_string())

# Sample 3 rows of purchase_orders:
print("\nSample 3 rows of purchase_orders:")
print(con.execute("SELECT * FROM purchase_orders LIMIT 3").df().to_string())

# Sample 3 rows of parts_master:
print("\nSample 3 rows of parts_master:")
print(con.execute("SELECT * FROM parts_master LIMIT 3").df().to_string())

# Sample 3 rows of quality_incidents:
print("\nSample 3 rows of quality_incidents:")
print(con.execute("SELECT * FROM quality_incidents LIMIT 3").df().to_string())
