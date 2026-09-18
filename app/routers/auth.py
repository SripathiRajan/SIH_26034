"""
Authentication Router
Supports OAuth2 password flows and JSON credentials for both CB1 and CB2 clients.
"""

import uuid
from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from pydantic import BaseModel

from core.database import get_db
from core.db_models import UserDB
from core.auth import hash_password, verify_password, create_access_token, get_current_user
from core.limiter import limiter

router = APIRouter(tags=["Authentication"])


class RegisterRequest(BaseModel):
    email: Optional[str] = None
    username: Optional[str] = None
    password: str
    full_name: Optional[str] = None
    role: Optional[str] = "inspector"


class LoginJSONRequest(BaseModel):
    email: Optional[str] = None
    username: Optional[str] = None
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: Optional[str] = None
    email: Optional[str] = None
    username: Optional[str] = None
    full_name: Optional[str] = None
    user: Optional[Dict[str, Any]] = None


def _authenticate_and_issue_token(identifier: str, password: str, db: Session) -> LoginResponse:
    user = (
        db.query(UserDB)
        .filter((UserDB.email == identifier) | (UserDB.username == identifier))
        .first()
    )
    if not user or not verify_password(password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username/email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = create_access_token({"sub": user.id, "role": user.role, "email": user.email or user.username})
    user_dict = {
        "id": user.id,
        "username": user.username or user.email,
        "email": user.email,
        "name": user.full_name or user.username or "Officer",
        "role": user.role,
        "department": "Legal Metrology Enforcement",
        "zone": user.zone,
        "badgeId": f"LM-{user.id[:6].upper()}",
    }
    return LoginResponse(
        access_token=token,
        token_type="bearer",
        user_id=user.id,
        email=user.email,
        username=user.username,
        full_name=user.full_name,
        user=user_dict,
    )


@router.post("/auth/register", status_code=status.HTTP_201_CREATED)
@router.post("/api/auth/register", status_code=status.HTTP_201_CREATED)
def register(req: RegisterRequest, db: Session = Depends(get_db)):
    identifier = req.email or req.username
    if not identifier:
        raise HTTPException(status_code=400, detail="Username or email is required")

    existing = (
        db.query(UserDB)
        .filter((UserDB.email == identifier) | (UserDB.username == identifier))
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail="User already registered")

    if len(req.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    user_id = uuid.uuid4().hex
    user = UserDB(
        id=user_id,
        email=req.email or identifier,
        username=req.username or identifier,
        hashed_password=hash_password(req.password),
        full_name=req.full_name or req.username,
        role="inspector",  # Always default to inspector; client-supplied role is ignored
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return {
        "message": "Account created successfully",
        "id": user.id,
        "user_id": user.id,
        "username": user.username,
        "email": user.email,
        "role": user.role,
    }


@router.post("/auth/token", response_model=LoginResponse)
@router.post("/api/auth/token", response_model=LoginResponse)
def token_form(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    return _authenticate_and_issue_token(form.username, form.password, db)


@router.post("/api/auth/login", response_model=LoginResponse)
@limiter.limit("10/minute")
def login_json(request: Request, payload: LoginJSONRequest, db: Session = Depends(get_db)):
    identifier = payload.username or payload.email
    if not identifier:
        raise HTTPException(status_code=400, detail="Username or email is required")
    return _authenticate_and_issue_token(identifier, payload.password, db)


@router.get("/api/auth/me")
def get_me(current_user: Optional[UserDB] = Depends(get_current_user)):
    if not current_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    return {
        "id": current_user.id,
        "name": current_user.full_name or current_user.username or "Officer",
        "username": current_user.username or current_user.email,
        "email": current_user.email,
        "role": current_user.role,
        "zone": current_user.zone,
        "badgeId": f"LM-{current_user.id[:6].upper()}",
    }
