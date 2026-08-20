"""Security-focused unit tests for authentication, roles, and account inputs."""
from pathlib import Path

import pytest
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from pydantic import ValidationError

from src.api import auth
from src.api.auth import User, create_access_token, current_user, require_roles
from src.api.routes.auth import CreateAccountBody
from src.api.routes.whatif import WhatIfBody


def test_viewer_password_is_hashed_and_can_authenticate(tmp_path: Path, monkeypatch):
    monkeypatch.setattr(auth, "_USERS_FILE", tmp_path / "users.json")
    viewer = auth.create_viewer("Priya Shah", "PRIYA@company.example", "SecurePass1")

    stored = (tmp_path / "users.json").read_text(encoding="utf-8")
    assert "SecurePass1" not in stored
    assert "password_hash" in stored
    assert auth.authenticate("priya@company.example", "SecurePass1") == viewer
    assert auth.authenticate("priya@company.example", "wrong-password") is None


def test_admin_can_assign_role_and_delete_managed_account(tmp_path: Path, monkeypatch):
    monkeypatch.setattr(auth, "_USERS_FILE", tmp_path / "users.json")
    analyst = auth.create_account("Raja Kumar", "raja@company.example", "SecurePass1", "ANALYST")
    assert analyst.role == "ANALYST"
    assert auth.authenticate("raja@company.example", "SecurePass1").role == "ANALYST"

    updated = auth.update_account_role("raja@company.example", "PLANNER")
    assert updated.role == "PLANNER"
    assert auth.authenticate("raja@company.example", "SecurePass1").role == "PLANNER"

    auth.delete_account("raja@company.example")
    assert auth.authenticate("raja@company.example", "SecurePass1") is None


@pytest.mark.parametrize("payload", [
    {"name": "A", "email": "viewer@company.example", "password": "SecurePass1"},
    {"name": "Valid Name", "email": "not-an-email", "password": "SecurePass1"},
    {"name": "Valid Name", "email": "viewer@company.example", "password": "alllowercase1"},
    {"name": "Valid Name", "email": "viewer@company.example", "password": "NoNumberPassword"},
    {"name": "Valid Name", "email": "viewer@company.example", "password": "SecurePass1", "role": "ADMIN"},
])
def test_viewer_account_input_is_validated(payload):
    with pytest.raises(ValidationError):
        CreateAccountBody(**payload)


def test_viewer_body_normalizes_email():
    body = CreateAccountBody(name="Valid Name", email="VIEWER@Company.Example", password="SecurePass1")
    assert body.email == "viewer@company.example"
    assert body.name == "Valid Name"


def test_viewer_cannot_use_planner_or_admin_actions():
    viewer = User(email="viewer@company.example", role="VIEWER", name="Viewer")
    planner_only = require_roles("PLANNER", "ADMIN")
    with pytest.raises(HTTPException) as exc:
        planner_only(viewer)
    assert exc.value.status_code == 403


def test_jwt_preserves_role_and_rejects_malformed_token():
    planner = User(email="planner@stockpilot.ai", role="PLANNER", name="Planner")
    token = create_access_token(planner)
    credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
    assert current_user(credentials).role == "PLANNER"
    with pytest.raises(HTTPException) as exc:
        current_user(HTTPAuthorizationCredentials(scheme="Bearer", credentials="not-a-jwt"))
    assert exc.value.status_code == 401


@pytest.mark.parametrize("payload", [
    {"store_id": "s", "product_id": "p", "discount": -0.01},
    {"store_id": "s", "product_id": "p", "discount": 0.51},
    {"store_id": "s", "product_id": "p", "price": 0},
    {"store_id": "s", "product_id": "p", "lead_time": 366},
])
def test_what_if_limits_are_enforced(payload):
    with pytest.raises(ValidationError):
        WhatIfBody(**payload)
