import duckdb
import pandas as pd
import json

db = duckdb.connect()

files = ["parts_master.csv", "purchase_orders.csv", "quality_incidents.csv", "supply_chain_history.csv"]
info = {}

for f in files:
    path = f"data/{f}"
    df = db.query(f"SELECT * FROM read_csv_auto('{path}')").df()
    columns = list(df.columns)
    types = [str(x) for x in df.dtypes]
    counts = len(df)
    
    info[f] = {
        "count": counts,
        "columns": dict(zip(columns, types))
    }

with open("scratch/inspection.json", "w") as out:
    json.dump(info, out, indent=2)
