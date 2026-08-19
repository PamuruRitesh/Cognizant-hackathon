import duckdb
import pandas as pd

def inspect_db():
    con = duckdb.connect('aerospace.duckdb')
    
    tables = con.execute("SHOW TABLES").df()
    print("Tables:", tables['name'].tolist())
    
    for t in tables['name']:
        print(f"\n--- Table: {t} ---")
        print(con.execute(f"DESCRIBE {t}").df()[['column_name', 'column_type']])
        print("\nSample:")
        print(con.execute(f"SELECT * FROM {t} LIMIT 3").df())

if __name__ == "__main__":
    inspect_db()
