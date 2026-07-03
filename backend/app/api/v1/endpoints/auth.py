# backend/app/api/v1/endpoints/auth.py
"""Authentication endpoints: register, login, refresh, logout, password reset."""
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.db.models.user import User
from app.db.models.role import Role
from app.services import auth_service
from app.services.audit_service import audit_login, audit_logout
from app.core.dependencies import get_current_user
from app.core.config import settings

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", status_code=201)
def register(payload: dict, db: Session = Depends(get_db)):
    from app.schemas.all_schemas import RegisterRequest
    from pydantic import ValidationError
    try:
        data = RegisterRequest(**payload)
    except Exception as e:
        raise HTTPException(422, str(e))

    if auth_service.get_user_by_email(db, data.email):
        raise HTTPException(400, "Email already registered")

    # Default role: viewer
    role = db.query(Role).filter_by(name="viewer").first()
    if not role:
        raise HTTPException(500, "Default role 'viewer' not configured. Ask your administrator to seed the database.")
    user = User(
        email=data.email,
        username=data.username,
        full_name=data.full_name,
        hashed_password=auth_service.hash_password(data.password),
        role_id=role.id,
        department=data.department,
        is_active=True,
        is_verified=False,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"message": "Registration successful", "user_id": user.id}


@router.post("/login")
def login(payload: dict, request: Request, db: Session = Depends(get_db)):
    user = auth_service.authenticate_user(db, payload["email"], payload["password"])
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    access_token, expire = auth_service.create_access_token(user.id, user.role.name)
    refresh_token = auth_service.create_refresh_token()

    auth_service.create_user_session(
        db, user.id, refresh_token,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )

    user.last_login_at = datetime.now(timezone.utc)
    db.commit()

    audit_login(db, user.id, request)

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        "user_id": user.id,
        "username": user.username,
        "full_name": user.full_name,
        "role": user.role.name,
        "permissions": [p.name for p in user.role.permissions],
    }


@router.post("/refresh")
def refresh(payload: dict, db: Session = Depends(get_db)):
    session = auth_service.get_session_by_refresh_token(db, payload["refresh_token"])
    if not session:
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")

    user = auth_service.get_user_by_id(db, session.user_id)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    access_token, expire = auth_service.create_access_token(user.id, user.role.name)
    return {
        "access_token": access_token,
        "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    }


@router.post("/logout")
def logout(
    payload: dict,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    auth_service.revoke_session(db, payload.get("refresh_token", ""))
    audit_logout(db, current_user.id, request)
    return {"message": "Logged out successfully"}


@router.get("/me")
def get_me(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "email": current_user.email,
        "username": current_user.username,
        "full_name": current_user.full_name,
        "department": current_user.department,
        "role": current_user.role.name,
        "permissions": [p.name for p in current_user.role.permissions],
        "is_active": current_user.is_active,
        "last_login_at": current_user.last_login_at,
    }
