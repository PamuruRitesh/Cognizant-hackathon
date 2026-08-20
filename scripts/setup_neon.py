"""
One-shot Neon setup: create the schema, load the seed, verify.

  python scripts/setup_neon.py            # create schema + load (refuses if data exists)
  python scripts/setup_neon.py --reset    # wipe the 11 tables first, then load
  python scripts/setup_neon.py --check    # verify only, change nothing

Reads DATABASE_URL from the environment or from .env in the repo root, so the
connection string is never typed on a command line. Uses psycopg2 directly, so
the psql client does NOT need to be installed.
"""
from __future__ import annotations

import io
import os
import sys

TABLES = [
    ("stores", "01_stores.csv"),
    ("skus", "02_skus.csv"),
    ("inventory_history", "03_inventory_history.csv"),
    ("daily_forecasts", "04_daily_forecasts.csv"),
    ("users", "05_users.csv"),
    ("purchase_orders", "06_purchase_orders.csv"),
    ("llm_audit_logs", "07_llm_audit_logs.csv"),
    ("system_audit_trace", "08_system_audit_trace.csv"),
    ("leadtime_forecasts", "09_leadtime_forecasts.csv"),
    ("backtest_metrics", "10_backtest_metrics.csv"),
    ("simulation_runs", "11_simulation_runs.csv"),
]
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SEED = os.path.join(ROOT, "neon_seed")
DDL = [os.path.join(ROOT, "db", "01_schema_base.sql"),
       os.path.join(ROOT, "db", "02_schema_extension.sql"),
       os.path.join(ROOT, "db", "03_schema_auth.sql")]


def get_url() -> str | None:
    u = os.environ.get("DATABASE_URL") or os.environ.get("NEON_DATABASE_URL")
    if u:
        return u.strip().strip('"').strip("'")
    for p in (os.path.join(ROOT, ".env"), ".env"):
        if os.path.exists(p):
            for line in open(p):
                line = line.strip()
                if line.startswith(("DATABASE_URL=", "NEON_DATABASE_URL=")):
                    return line.split("=", 1)[1].strip().strip('"').strip("'")
    return None


def header(url: str) -> None:
    host = url.split("@")[-1].split("/")[0] if "@" in url else "?"
    print(f"Host: {host}")          # host only, never the password
    print("-" * 58)


def counts(cur) -> dict:
    out = {}
    cur.execute("""select table_name from information_schema.tables
                   where table_schema='public'""")
    present = {r[0] for r in cur.fetchall()}
    for t, _ in TABLES:
        if t in present:
            cur.execute(f'select count(*) from "{t}"')
            out[t] = cur.fetchone()[0]
        else:
            out[t] = None
    return out


def report(c: dict) -> int:
    print(f"  {'TABLE':22s} {'ROWS':>9s}")
    total = 0
    missing = []
    for t, _ in TABLES:
        n = c[t]
        if n is None:
            print(f"  {t:22s} {'MISSING':>9s}")
            missing.append(t)
        else:
            total += n
            print(f"  {t:22s} {n:>9,}")
    print("-" * 58)
    print(f"  {'TOTAL':22s} {total:>9,}")
    if missing:
        print(f"\nVERDICT: schema incomplete - {len(missing)} table(s) missing: {', '.join(missing)}")
        return 1
    if total == 0:
        print("\nVERDICT: schema exists but is EMPTY - run without --check to load the seed.")
        return 1
    print("\nVERDICT: connected, schema complete, data present.")
    return 0


def main() -> int:
    reset = "--reset" in sys.argv
    check_only = "--check" in sys.argv

    url = get_url()
    if not url:
        print("FAIL  No DATABASE_URL found.")
        print("      Add this to .env in the repo root, one line, no quotes:")
        print("      DATABASE_URL=postgresql://user:pass@ep-xxx.neon.tech/db?sslmode=require")
        return 1
    header(url)

    try:
        import psycopg2
    except ImportError:
        print("FAIL  psycopg2 not installed  ->  pip install psycopg2-binary")
        return 1

    try:
        conn = psycopg2.connect(url, connect_timeout=20)
    except Exception as e:
        print(f"FAIL  Could not connect: {e}")
        print("\n      Check, in this order:")
        print("        1. the string is ONE line in .env with no quotes")
        print("        2. it ends with ?sslmode=require")
        print("        3. the Neon compute is awake (open the console once)")
        print("        4. the password has not been rotated")
        return 1

    conn.autocommit = True
    cur = conn.cursor()
    cur.execute("select current_database(), current_user, version()")
    db, user, ver = cur.fetchone()
    print(f"OK    Connected.  db={db}  user={user}")
    print(f"      {ver.split(',')[0]}\n")

    if check_only:
        return report(counts(cur))

    # ---- schema -----------------------------------------------------------
    for path in DDL:
        if not os.path.exists(path):
            print(f"FAIL  Missing {path}")
            return 1
        print(f"Applying {os.path.basename(path)} ...")
        try:
            cur.execute(open(path).read())
        except Exception as e:
            print(f"FAIL  {e}")
            return 1
    print("OK    Schema created/updated (idempotent).\n")

    # ---- guard against double-loading -------------------------------------
    existing = counts(cur)
    have = sum(n for n in existing.values() if n)
    if have and not reset:
        print(f"STOP  The database already holds {have:,} rows.")
        print("      Loading again would duplicate rows or break primary keys.")
        print("      Re-run with --reset to wipe these 11 tables and reload,")
        print("      or with --check to just inspect what is there.")
        return 1
    if reset and have:
        names = ", ".join(t for t, _ in TABLES)
        print(f"Resetting {len(TABLES)} tables ...")
        cur.execute(f"truncate {names} restart identity cascade")
        print("OK    Cleared.\n")

    # ---- load -------------------------------------------------------------
    if not os.path.isdir(SEED):
        print(f"FAIL  Seed folder not found: {SEED}")
        return 1
    print("Loading seed ...")
    for table, fname in TABLES:
        path = os.path.join(SEED, fname)
        if not os.path.exists(path):
            print(f"  {table:22s} SKIPPED (no {fname})")
            continue
        with open(path, "r", encoding="utf-8") as f:
            cols = f.readline().strip()
            body = f.read()
        try:
            cur.copy_expert(
                f'COPY "{table}" ({cols}) FROM STDIN WITH (FORMAT csv, NULL \'\')',
                io.StringIO(body))
            print(f"  {table:22s} loaded")
        except Exception as e:
            print(f"  {table:22s} FAILED: {str(e).strip()[:160]}")
            return 1
    print()
    return report(counts(cur))


if __name__ == "__main__":
    sys.exit(main())
