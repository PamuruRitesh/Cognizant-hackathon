"""
Authentication middleware for StockPilot.

Provides JWT token creation/validation and FastAPI dependencies for
role-based access control on protected endpoints.
"""
from __future__ import annotations

import json
import os
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
from fastapi import Depends, HTTPException, Request, status
from jose import JWTError, jwt

from . import data_access, db

# Secret key — in production, load from env / vault. For the hackathon demo
# a hardcoded default is fine.
SECRET_KEY = os.environ.get("STOCKPILOT_JWT_SECRET", "stockpilot-demo-secret-key-change-me")
ALGORITHM = "HS256"
TOKEN_EXPIRE_MINUTES = int(os.environ.get("STOCKPILOT_TOKEN_EXPIRE_MINUTES", "1440"))  # 24 h


# ---------------------------------------------------------------- passwords --

def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


# ------------------------------------------------------------------- tokens --

def create_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> dict:
    return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])


# --------------------------------------------------------------- user CRUD --

_USER_BY_EMAIL = "SELECT user_id, email, role, password_hash FROM users WHERE email = %s"
_USER_BY_ID = "SELECT user_id, email, role FROM users WHERE user_id = %s::uuid"
_ALL_USERS = "SELECT user_id, email, role, created_at FROM users ORDER BY created_at DESC"
_INSERT_USER = """
    INSERT INTO users (email, role, password_hash)
    VALUES (%s, %s, %s)
    RETURNING user_id, email, role, created_at
"""
_DELETE_USER = "DELETE FROM users WHERE user_id = %s::uuid RETURNING user_id"


def _use_db() -> bool:
    return db.database_url() is not None


def _ensure_db_schema():
    if _use_db():
        try:
            db.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;")
            db.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();")
        except Exception:
            pass


# Run DB schema auto-migration if connected
_ensure_db_schema()


def _get_fallback_users() -> list[dict]:
    path = os.path.join(data_access.DATA_DIR, "users.json")
    if os.path.exists(path):
        try:
            with open(path, "r") as f:
                return json.load(f)
        except Exception:
            pass
    now_iso = datetime.now(timezone.utc).isoformat()
    initial = [
        {"user_id": "00000000-0000-0000-0000-000000000001", "email": "admin@stockpilot.io",
         "role": "admin", "password_hash": hash_password("demo123"), "created_at": now_iso},
        {"user_id": "00000000-0000-0000-0000-000000000002", "email": "planner@stockpilot.io",
         "role": "planner", "password_hash": hash_password("demo123"), "created_at": now_iso},
        {"user_id": "00000000-0000-0000-0000-000000000003", "email": "analyst@stockpilot.io",
         "role": "analyst", "password_hash": hash_password("demo123"), "created_at": now_iso},
        {"user_id": "00000000-0000-0000-0000-000000000004", "email": "viewer@stockpilot.io",
         "role": "viewer", "password_hash": hash_password("demo123"), "created_at": now_iso},
    ]
    _save_fallback_users(initial)
    return initial


def _save_fallback_users(users: list[dict]) -> None:
    path = os.path.join(data_access.DATA_DIR, "users.json")
    try:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w") as f:
            json.dump(users, f, indent=2)
    except Exception as e:
        print("Failed to save fallback users:", e)


def get_user_by_email(email: str) -> Optional[dict]:
    if _use_db():
        try:
            _ensure_db_schema()
            rows = db.query(_USER_BY_EMAIL, (email,))
            if rows:
                r = rows[0]
                return {"user_id": str(r["user_id"]), "email": r["email"],
                        "role": r["role"], "password_hash": r.get("password_hash")}
        except db.DBUnavailable:
            pass
    for u in _get_fallback_users():
        if u["email"] == email:
            return dict(u)
    return None


def get_user_by_id(user_id: str) -> Optional[dict]:
    if _use_db():
        try:
            _ensure_db_schema()
            rows = db.query(_USER_BY_ID, (user_id,))
            if rows:
                r = rows[0]
                return {"user_id": str(r["user_id"]), "email": r["email"], "role": r["role"]}
        except db.DBUnavailable:
            pass
    for u in _get_fallback_users():
        if u["user_id"] == user_id:
            return {"user_id": u["user_id"], "email": u["email"], "role": u["role"]}
    return None


def list_users() -> list[dict]:
    if _use_db():
        try:
            _ensure_db_schema()
            rows = db.query(_ALL_USERS)
            if rows:
                return [{"user_id": str(r["user_id"]), "email": r["email"],
                         "role": r["role"],
                         "created_at": r["created_at"].isoformat() if hasattr(r.get("created_at"), "isoformat") else r.get("created_at")}
                        for r in rows]
        except db.DBUnavailable:
            pass
    return [{"user_id": u["user_id"], "email": u["email"], "role": u["role"],
             "created_at": u.get("created_at")} for u in _get_fallback_users()]


def create_user(email: str, role: str, password: str) -> dict:
    pw_hash = hash_password(password)
    now_iso = datetime.now(timezone.utc).isoformat()
    if _use_db():
        try:
            _ensure_db_schema()
            rows = db.query(_INSERT_USER, (email, role, pw_hash))
            if rows:
                r = rows[0]
                return {"user_id": str(r["user_id"]), "email": r["email"], "role": r["role"], "created_at": r.get("created_at")}
        except db.DBUnavailable:
            pass
    # Fallback: add to persistent JSON file & in-memory list
    import uuid
    new_user = {"user_id": str(uuid.uuid4()), "email": email, "role": role,
                "password_hash": pw_hash, "created_at": now_iso}
    users = _get_fallback_users()
    users.append(new_user)
    _save_fallback_users(users)
    return {"user_id": new_user["user_id"], "email": email, "role": role, "created_at": now_iso}


def delete_user(user_id: str) -> bool:
    if _use_db():
        try:
            _ensure_db_schema()
            rows = db.query(_DELETE_USER, (user_id,))
            return bool(rows)
        except db.DBUnavailable:
            pass
    users = _get_fallback_users()
    filtered = [u for u in users if u["user_id"] != user_id]
    if len(filtered) < len(users):
        _save_fallback_users(filtered)
        return True
    return False


# -------------------------------------------------------- FastAPI deps --

def _extract_token(request: Request) -> Optional[str]:
    auth = request.headers.get("Authorization")
    if auth and auth.startswith("Bearer "):
        return auth[7:]
    return None


async def get_current_user(request: Request) -> dict:
    """FastAPI dependency: returns the current authenticated user or raises 401."""
    token = _extract_token(request)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="Not authenticated",
                            headers={"WWW-Authenticate": "Bearer"})
    try:
        payload = decode_token(token)
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                                detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="Invalid or expired token")

    user = get_user_by_id(user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="User not found")
    return user


def require_role(*allowed_roles: str):
    """Factory that returns a FastAPI dependency checking the user's role."""

    async def _check(user: dict = Depends(get_current_user)) -> dict:
        if user["role"] not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{user['role']}' is not authorized. Required: {', '.join(allowed_roles)}")
        return user

    return _check
