"""
Proves the dashboard reads from Postgres, and times every endpoint so a slow
one is obvious.

  python scripts/prove_db.py

Three parts:
  1. every endpoint, with a wall-clock time and a 20s timeout
  2. raw SQL against Neon vs what /api/kpis returns -- they must match
  3. a live mutation: change a row IN THE DATABASE, watch the API number move,
     then change it back. Hardcoded data cannot do this.
"""
from __future__ import annotations

import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import requests

API = os.environ.get("STOCKPILOT_API", "http://localhost:8000")
TIMEOUT = 20


def hit(path):
    t0 = time.time()
    try:
        r = requests.get(f"{API}{path}", timeout=TIMEOUT)
        return r.status_code, round(time.time() - t0, 2), r
    except requests.exceptions.Timeout:
        return "TIMEOUT", TIMEOUT, None
    except Exception as e:
        return f"ERR {type(e).__name__}", round(time.time() - t0, 2), None


def part1():
    print("=" * 66)
    print("1. ENDPOINT HEALTH AND TIMING")
    print("=" * 66)
    for p in ["/api/health", "/api/db-status", "/api/kpis", "/api/risk?limit=5",
              "/api/recommendations?limit=5", "/api/simulation", "/api/audit?limit=5",
              "/api/skus", "/api/agent-status"]:
        code, secs, _ = hit(p)
        flag = "  <-- SLOW" if isinstance(secs, float) and secs > 3 else ""
        print(f"  {str(code):>14}  {secs:>6}s  {p}{flag}")


def part2():
    print()
    print("=" * 66)
    print("2. RAW SQL vs API  (same numbers = the API is reading the database)")
    print("=" * 66)
    from src.api import db
    if not db.database_url():
        print("  DATABASE_URL not set - skipping")
        return None

    sql = """
      select count(*) filter (where stockout_risk_7d > 0.5
                              and status = 'PENDING_APPROVAL')       as risky,
             coalesce(sum(cost_if_ignored) filter
                      (where status = 'PENDING_APPROVAL'), 0)        as at_risk,
             count(*) filter (where status = 'PENDING_APPROVAL')     as pending
      from purchase_orders
    """
    row = db.query(sql)[0]
    code, _, r = hit("/api/kpis")
    if code != 200:
        print(f"  /api/kpis returned {code} - cannot compare")
        return None
    api = r.json()

    print(f"  {'FIGURE':<26} {'FROM SQL':>14} {'FROM API':>14}   MATCH")
    pairs = [("stockout_risk_skus", int(row["risky"]), api.get("stockout_risk_skus")),
             ("value_at_risk", round(float(row["at_risk"]), 2), api.get("value_at_risk")),
             ("pending_approvals", int(row["pending"]), api.get("pending_approvals"))]
    allok = True
    for name, sqlv, apiv in pairs:
        ok = abs(float(sqlv) - float(apiv or 0)) < 0.02
        allok &= ok
        print(f"  {name:<26} {sqlv:>14} {str(apiv):>14}   {'yes' if ok else 'NO'}")
    return allok


def part3():
    print()
    print("=" * 66)
    print("3. LIVE MUTATION  (change the DB, watch the API follow)")
    print("=" * 66)
    from src.api import db
    if not db.database_url():
        print("  DATABASE_URL not set - skipping")
        return

    target = db.query("""select rec_id, cost_if_ignored from purchase_orders
                         where status = 'PENDING_APPROVAL'
                           and cost_if_ignored is not null
                         order by rec_id limit 1""")
    if not target:
        print("  no pending row to test with - skipping")
        return
    rec_id = target[0]["rec_id"]
    original = float(target[0]["cost_if_ignored"])

    code, _, r = hit("/api/kpis")
    if r is None:
        print(f"  /api/kpis unreachable ({code}) - skipping")
        return
    before = r.json().get("value_at_risk")
    print(f"  API value_at_risk now .......... {before}")
    print(f"  bumping {rec_id} by +1000 directly in Postgres ...")

    db.execute("update purchase_orders set cost_if_ignored = %s where rec_id = %s",
               (original + 1000, rec_id))
    try:
        _, _, r = hit("/api/kpis")
        if r is None:
            print("  /api/kpis unreachable mid-test - reverting")
            return
        after = r.json().get("value_at_risk")
        print(f"  API value_at_risk now .......... {after}")
        moved = round(float(after) - float(before), 2)
        print(f"  moved by ....................... {moved}")
        verdict = "PROVEN: the API is reading live from Postgres." if abs(moved - 1000) < 0.02 \
                  else "UNEXPECTED: the number did not move by 1000."
    finally:
        db.execute("update purchase_orders set cost_if_ignored = %s where rec_id = %s",
                   (original, rec_id))
        print(f"  reverted {rec_id} to {original}")
    print()
    print(f"  {verdict}")


if __name__ == "__main__":
    part1()
    part2()
    part3()
