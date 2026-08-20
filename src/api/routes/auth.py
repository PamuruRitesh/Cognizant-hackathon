"""Auth routes: login, register, user management."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr

from ..auth_middleware import (
    create_token,
    create_user,
    delete_user,
    get_current_user,
    get_user_by_email,
    list_users,
    require_role,
    verify_password,
)

router = APIRouter(prefix="/auth", tags=["auth"])


# ---------------------------------------------------------------- schemas --

class LoginRequest(BaseModel):
    email: str
    password: str


class RegisterRequest(BaseModel):
    email: str
    password: str
    role: str = "viewer"


# ---------------------------------------------------------------- routes --

@router.post("/login")
def login(body: LoginRequest):
    user = get_user_by_email(body.email)
    if not user or not user.get("password_hash"):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_token({"sub": user["user_id"], "email": user["email"], "role": user["role"]})
    return {
        "token": token,
        "user": {
            "user_id": user["user_id"],
            "email": user["email"],
            "role": user["role"],
        },
    }


@router.get("/me")
def me(user: dict = Depends(get_current_user)):
    return {"user": user}


@router.post("/register")
def register(body: RegisterRequest, admin: dict = Depends(require_role("admin"))):
    """Create a new user. Admin-only."""
    existing = get_user_by_email(body.email)
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")
    if body.role not in ("admin", "planner", "analyst", "viewer"):
        raise HTTPException(status_code=400, detail="Invalid role")
    new_user = create_user(body.email, body.role, body.password)
    return {"user": new_user}


@router.get("/users")
def get_all_users(admin: dict = Depends(require_role("admin"))):
    """List all users. Admin-only."""
    return {"users": list_users()}


@router.delete("/users/{user_id}")
def remove_user(user_id: str, admin: dict = Depends(require_role("admin"))):
    """Delete a user. Admin-only. Cannot delete yourself."""
    if user_id == admin["user_id"]:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    if not delete_user(user_id):
        raise HTTPException(status_code=404, detail="User not found")
    return {"deleted": user_id}
