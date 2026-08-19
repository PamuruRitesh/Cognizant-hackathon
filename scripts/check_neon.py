"""
Check the Neon connection and report what's actually in the database.

Reads DATABASE_URL from the environment or from .env in the repo root, so the
connection string never has to be typed on a command line or pasted anywhere.

  pip install psycopg2-binary python-dotenv
  python check_neon.py
"""
from __future__ import annotations

import os
import sys

EXPECTED = [
    "stores", "skus", "inventory_history", "daily_forecasts",
    "users", "purchase_orders", "llm_audit_logs", "system_audit_trace",
]
SEEDED = {"stores": 1, "skus": 50, "inventory_history": 20177,
          "daily_forecasts": 700, "users": 2, "purchase_orders": 50,
          "llm_audit_logs": 50, "system_audit_trace": 100}


def get_url() -> str | None:
    url = os.environ.get("DATABASE_URL") or os.environ.get("NEON_DATABASE_URL")
    if url:
        return url
    for path in (".env", "../.env"):
        if os.path.exists(path):
            for line in open(path):
                line = line.strip()
                if line.startswith(("DATABASE_URL=", "NEON_DATABASE_URL=")):
                    return line.split("=", 1)[1].strip().strip('"').strip("'")
    return None


def main() -> int:
    url = get_url()
    if not url:
        print("FAIL  No DATABASE_URL found.")
        print("      Add this line to your .env (no quotes, all one line):")
        print("      DATABASE_URL=postgresql://user:pass@ep-xxx.neon.tech/dbname?sslmode=require")
        return 1

    # Never print the credentials themselves.
    host = url.split("@")[-1].split("/")[0] if "@" in url else "?"
    print(f"Connecting to host: {host}")

    try:
        import psycopg2
    except ImportError:
        print("FAIL  psycopg2 not installed.  ->  pip install psycopg2-binary")
        return 1

    try:
        conn = psycopg2.connect(url, connect_timeout=15)
    except Exception as e:
        print(f"FAIL  Could not connect: {e}")
        print("      Common causes: sslmode=require missing, password wrong,")
        print("      compute suspended (open the Neon console once to wake it),")
        print("      or the string was wrapped across two lines in .env.")
        return 1

    cur = conn.cursor()
    cur.execute("select version(), current_database(), current_user")
    ver, db, user = cur.fetchone()
    print(f"OK    Connected.  db={db}  user={user}")
    print(f"      {ver.split(',')[0]}")

    cur.execute("""select table_name from information_schema.tables
                   where table_schema='public' order by table_name""")
    found = [r[0] for r in cur.fetchall()]
    print(f"\nTables in public schema: {len(found)}")
    if not found:
        print("  (empty — the schema has not been created yet)")

    print("\n  TABLE                  EXISTS   ROWS      SEED EXPECTED")
    total = 0
    for t in EXPECTED:
        if t in found:
            cur.execute(f'select count(*) from "{t}"')
            n = cur.fetchone()[0]
            total += n
            exp = SEEDED[t]
            mark = "match" if n == exp else ("EMPTY" if n == 0 else f"differs")
            print(f"  {t:22s} yes    {n:>7,}    {exp:>7,}  {mark}")
        else:
            print(f"  {t:22s} NO           -    {SEEDED[t]:>7,}  missing")

    extra = [t for t in found if t not in EXPECTED]
    if extra:
        print(f"\n  Other tables present: {', '.join(extra)}")

    print(f"\nTotal rows across the 8 expected tables: {total:,}")
    missing = [t for t in EXPECTED if t not in found]
    if missing:
        print(f"VERDICT: schema incomplete — missing {len(missing)}: {', '.join(missing)}")
    elif total == 0:
        print("VERDICT: schema exists but is EMPTY — the seed has not been loaded.")
    elif total == sum(SEEDED.values()):
        print("VERDICT: connected, schema complete, seed fully loaded.")
    else:
        print("VERDICT: connected, schema complete, row counts differ from the seed.")

    cur.close()
    conn.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
