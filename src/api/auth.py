"""JWT authentication and role helpers for the StockPilot API."""
from __future__ import annotations

import os
import json
import threading
from datetime import datetime, timedelta, timezone
from pathlib import Path

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from pydantic import BaseModel
import bcrypt

ALGORITHM = "HS256"
bearer_scheme = HTTPBearer(auto_error=False)
_USERS_FILE = Path(__file__).resolve().parents[2] / "data" / "users.json"
_users_lock = threading.Lock()
MANAGED_ROLES = {"PLANNER", "ANALYST", "VIEWER"}


class User(BaseModel):
    email: str
    role: str
    name: str


def _secret() -> str:
    # Set STOCKPILOT_JWT_SECRET outside local development.
    return os.getenv("STOCKPILOT_JWT_SECRET") or "stockpilot-local-development-secret"


def _built_in_accounts() -> dict[str, User]:
    return {
        "planner@stockpilot.ai": User(email="planner@stockpilot.ai", role="PLANNER", name="Planner"),
        "admin@stockpilot.ai": User(email="admin@stockpilot.ai", role="ADMIN", name="Administrator"),
    }


def _load_managed_accounts() -> list[dict]:
    if not _USERS_FILE.exists():
        return []
    try:
        records = json.loads(_USERS_FILE.read_text(encoding="utf-8"))
        return records if isinstance(records, list) else []
    except (OSError, json.JSONDecodeError):
        return []


def list_accounts() -> list[User]:
    """Return built-in accounts plus accounts managed by an administrator."""
    accounts = list(_built_in_accounts().values())
    for record in _load_managed_accounts():
        try:
            role = record.get("role", "VIEWER").upper()
            if role in MANAGED_ROLES:
                accounts.append(User(email=record["email"], role=role, name=record["name"]))
        except (KeyError, ValueError):
            continue
    return accounts


def _save_managed_accounts(records: list[dict]) -> None:
    _USERS_FILE.parent.mkdir(parents=True, exist_ok=True)
    temporary = _USERS_FILE.with_suffix(".tmp")
    temporary.write_text(json.dumps(records, indent=2), encoding="utf-8")
    temporary.replace(_USERS_FILE)


def create_account(name: str, email: str, password: str, role: str = "VIEWER") -> User:
    email = email.strip().lower()
    role = role.strip().upper()
    if role not in MANAGED_ROLES:
        raise ValueError("Role must be Planner, Analyst, or Viewer")
    if email in _built_in_accounts() or any(record.get("email") == email for record in _load_managed_accounts()):
        raise ValueError("An account with this email already exists")
    user = User(email=email, role=role, name=name.strip())
    record = {"email": user.email, "name": user.name, "role": user.role, "password_hash": bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()}
    with _users_lock:
        records = _load_managed_accounts()
        if any(existing.get("email") == user.email for existing in records):
            raise ValueError("An account with this email already exists")
        _save_managed_accounts([*records, record])
    return user


def create_viewer(name: str, email: str, password: str) -> User:
    """Backward-compatible helper for callers that create a Viewer."""
    return create_account(name, email, password, "VIEWER")


def update_account_role(email: str, role: str) -> User:
    email, role = email.strip().lower(), role.strip().upper()
    if email in _built_in_accounts():
        raise ValueError("Built-in accounts cannot be changed")
    if role not in MANAGED_ROLES:
        raise ValueError("Role must be Planner, Analyst, or Viewer")
    with _users_lock:
        records = _load_managed_accounts()
        for record in records:
            if record.get("email") == email:
                record["role"] = role
                _save_managed_accounts(records)
                return User(email=email, name=record["name"], role=role)
    raise LookupError("Account not found")


def delete_account(email: str) -> None:
    email = email.strip().lower()
    if email in _built_in_accounts():
        raise ValueError("Built-in accounts cannot be deleted")
    with _users_lock:
        records = _load_managed_accounts()
        remaining = [record for record in records if record.get("email") != email]
        if len(remaining) == len(records):
            raise LookupError("Account not found")
        _save_managed_accounts(remaining)


def authenticate(email: str, password: str) -> User | None:
    accounts = _built_in_accounts()
    user = accounts.get(email.strip().lower())
    if user:
        expected = os.getenv(f"STOCKPILOT_{user.role}_PASSWORD", "stockpilot")
        return user if password == expected else None
    for record in _load_managed_accounts():
        if record.get("email") == email.strip().lower() and bcrypt.checkpw(password.encode(), record.get("password_hash", "").encode()):
            role = record.get("role", "VIEWER").upper()
            if role in MANAGED_ROLES:
                return User(email=record["email"], role=role, name=record["name"])
    return None


def create_access_token(user: User) -> str:
    try:
        expires_in = int(os.getenv("STOCKPILOT_TOKEN_EXPIRE_MINUTES", "1440"))
    except ValueError:
        expires_in = 1440
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=expires_in)
    return jwt.encode(
        {"sub": user.email, "role": user.role, "name": user.name, "type": "access", "exp": expires_at},
        _secret(), algorithm=ALGORITHM,
    )


def current_user(credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme)) -> User:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Authentication required")
    try:
        payload = jwt.decode(credentials.credentials, _secret(), algorithms=[ALGORITHM])
        if payload.get("type") != "access":
            raise JWTError("Invalid token type")
        return User(email=payload["sub"], role=payload["role"], name=payload["name"])
    except (JWTError, KeyError, ValueError):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Your session has expired. Please sign in again.")


def require_roles(*roles: str):
    allowed = {role.upper() for role in roles}

    def check(user: User = Depends(current_user)) -> User:
        if user.role.upper() not in allowed:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "You do not have permission for this action")
        return user

    return check
