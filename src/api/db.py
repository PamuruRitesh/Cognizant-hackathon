"""
Postgres/Neon connection layer.

One pool for the whole API. Every read in data_access.py goes through here.

Env:
  DATABASE_URL   postgresql://user:pass@ep-xxx.neon.tech/db?sslmode=require
  DB_FALLBACK    "true" (default) -> fall back to the parquet/JSON files if the
                 database is unreachable, so a dead network never kills the demo.
                 Set "false" to fail loudly instead.

Neon serverless computes suspend when idle and take a few seconds to wake, so
the first connection is retried before we call the database down.
"""
from __future__ import annotations

import os
import threading
import time

_pool = None
_lock = threading.Lock()
_state = {"checked": 0.0, "up": False, "reason": "not checked yet"}


class DBUnavailable(RuntimeError):
    """Raised when Postgres cannot be reached."""


def database_url() -> str | None:
    url = os.environ.get("DATABASE_URL") or os.environ.get("NEON_DATABASE_URL")
    if url:
        return url.strip().strip('"').strip("'")
    for path in (".env", os.path.join(os.path.dirname(__file__), "..", "..", ".env")):
        if os.path.exists(path):
            for line in open(path):
                line = line.strip()
                if line.startswith(("DATABASE_URL=", "NEON_DATABASE_URL=")):
                    return line.split("=", 1)[1].strip().strip('"').strip("'")
    return None


def fallback_enabled() -> bool:
    return os.environ.get("DB_FALLBACK", "true").lower() != "false"


def _build_pool():
    from psycopg2.pool import ThreadedConnectionPool

    url = database_url()
    if not url:
        raise DBUnavailable("DATABASE_URL is not set")
    last = None
    for attempt in range(3):  # Neon cold start can take a few seconds
        try:
            return ThreadedConnectionPool(1, 10, url, connect_timeout=15)
        except Exception as e:
            last = e
            time.sleep(1.5 * (attempt + 1))
    raise DBUnavailable(f"could not connect: {last}")


def pool():
    global _pool
    if _pool is None:
        with _lock:
            if _pool is None:
                _pool = _build_pool()
    return _pool


class connection:
    """`with connection() as conn:` — borrows from the pool and always returns it."""

    def __enter__(self):
        try:
            self._p = pool()
            self._c = self._p.getconn()
        except DBUnavailable:
            raise
        except Exception as e:
            raise DBUnavailable(str(e)) from e
        return self._c

    def __exit__(self, exc_type, exc, tb):
        try:
            if exc_type is None:
                self._c.commit()
            else:
                self._c.rollback()
        finally:
            self._p.putconn(self._c)
        return False


def query(sql: str, params: tuple | None = None) -> list[dict]:
    """SELECT returning a list of dicts."""
    from psycopg2.extras import RealDictCursor
    try:
        with connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(sql, params or ())
                return [dict(r) for r in cur.fetchall()]
    except DBUnavailable:
        raise
    except Exception as e:
        raise DBUnavailable(f"query failed: {e}") from e


def query_df(sql: str, params: tuple | None = None):
    import pandas as pd
    return pd.DataFrame(query(sql, params))


def execute(sql: str, params: tuple | None = None) -> int:
    """INSERT/UPDATE/DELETE. Returns affected row count."""
    try:
        with connection() as conn:
            with conn.cursor() as cur:
                cur.execute(sql, params or ())
                return cur.rowcount
    except DBUnavailable:
        raise
    except Exception as e:
        raise DBUnavailable(f"execute failed: {e}") from e


def execute_many(sql: str, rows: list[tuple]) -> int:
    try:
        with connection() as conn:
            with conn.cursor() as cur:
                cur.executemany(sql, rows)
                return cur.rowcount
    except DBUnavailable:
        raise
    except Exception as e:
        raise DBUnavailable(f"execute_many failed: {e}") from e


def status(max_age: float = 30.0) -> dict:
    """Cached health check for /api/db-status and the UI badge."""
    now = time.time()
    if now - _state["checked"] < max_age and _state["checked"]:
        return {"connected": _state["up"], "reason": _state["reason"], **_host()}
    try:
        r = query("select 1 as ok")
        _state.update(checked=now, up=bool(r), reason="ok")
    except Exception as e:
        _state.update(checked=now, up=False, reason=str(e)[:200])
    return {"connected": _state["up"], "reason": _state["reason"], **_host()}


def _host() -> dict:
    """Host only — never the credentials."""
    url = database_url()
    if not url:
        return {"host": None, "fallback": fallback_enabled()}
    host = url.split("@")[-1].split("/")[0] if "@" in url else "?"
    return {"host": host, "fallback": fallback_enabled()}


def available() -> bool:
    return status()["connected"]
