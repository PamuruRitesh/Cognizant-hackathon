import re

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, field_validator

from ..auth import (MANAGED_ROLES, User, authenticate, create_access_token, create_account,
                    current_user, delete_account, list_accounts, require_roles, update_account_role)

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginBody(BaseModel):
    email: str = Field(min_length=5, max_length=254)
    password: str = Field(min_length=1, max_length=128)


class CreateAccountBody(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    email: str = Field(min_length=5, max_length=254)
    password: str = Field(min_length=8, max_length=128)
    role: str = "VIEWER"

    @field_validator("name")
    @classmethod
    def valid_name(cls, value: str) -> str:
        value = value.strip()
        # ``str.isprintable`` treats a normal space as non-printable. Accept
        # names with spaces, while still rejecting control characters and tags.
        if len(value) < 2 or any(ord(char) < 32 or char in "<>" for char in value):
            raise ValueError("Name must contain 2-100 valid characters")
        return value

    @field_validator("email")
    @classmethod
    def valid_company_email(cls, value: str) -> str:
        value = value.strip().lower()
        if not re.fullmatch(r"[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+", value):
            raise ValueError("Enter a valid company email address")
        return value

    @field_validator("password")
    @classmethod
    def strong_password(cls, value: str) -> str:
        if not (re.search(r"[a-z]", value) and re.search(r"[A-Z]", value) and re.search(r"\d", value)):
            raise ValueError("Temporary password must include upper-case, lower-case, and a number")
        return value

    @field_validator("role")
    @classmethod
    def allowed_role(cls, value: str) -> str:
        role = value.strip().upper()
        if role not in MANAGED_ROLES:
            raise ValueError("Role must be Planner, Analyst, or Viewer")
        return role


class UpdateRoleBody(BaseModel):
    role: str

    @field_validator("role")
    @classmethod
    def allowed_role(cls, value: str) -> str:
        role = value.strip().upper()
        if role not in MANAGED_ROLES:
            raise ValueError("Role must be Planner, Analyst, or Viewer")
        return role


@router.post("/login")
def login(body: LoginBody):
    user = authenticate(body.email, body.password)
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")
    return {"access_token": create_access_token(user), "token_type": "bearer", "user": user.model_dump()}


@router.get("/me", response_model=User)
def me(user: User = Depends(current_user)):
    return user


@router.get("/accounts", response_model=list[User])
def accounts(_: User = Depends(require_roles("ADMIN"))):
    return list_accounts()


@router.post("/accounts", response_model=User, status_code=status.HTTP_201_CREATED)
def add_account(body: CreateAccountBody, _: User = Depends(require_roles("ADMIN"))):
    try:
        return create_account(body.name, body.email, body.password, body.role)
    except ValueError as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc))


@router.patch("/accounts/{email}/role", response_model=User)
def change_role(email: str, body: UpdateRoleBody, _: User = Depends(require_roles("ADMIN"))):
    try:
        return update_account_role(email, body.role)
    except LookupError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc))
    except ValueError as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc))


@router.delete("/accounts/{email}", status_code=status.HTTP_204_NO_CONTENT)
def remove_account(email: str, _: User = Depends(require_roles("ADMIN"))):
    try:
        delete_account(email)
    except LookupError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc))
    except ValueError as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc))
