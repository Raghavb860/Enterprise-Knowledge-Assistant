# backend/app/services/auth_service.py
"""
Authentication Service
- Password hashing with bcrypt
- JWT access + refresh tokens
- User lookup and session management
"""
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.models.user import User, UserSession
from app.db.models.role import Role

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto", bcrypt__rounds=12)


# ─── Password ─────────────────────────────────────────────────────────────────

def hash_password(plain: str) -> str:
    return pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


# ─── Tokens ───────────────────────────────────────────────────────────────────

def create_access_token(user_id: str, role: str) -> tuple[str, datetime]:
    """Returns (token_string, expiry_datetime)."""
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )
    payload = {
        "sub": user_id,
        "role": role,
        "type": "access",
        "exp": expire,
        "iat": datetime.now(timezone.utc),
    }
    token = jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return token, expire


def create_refresh_token() -> str:
    return secrets.token_urlsafe(64)


def decode_access_token(token: str) -> dict:
    """Raises JWTError on invalid/expired token."""
    return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])


# ─── User Auth ────────────────────────────────────────────────────────────────

def authenticate_user(db: Session, email: str, password: str) -> Optional[User]:
    user = db.query(User).filter(User.email == email, User.is_active == True).first()
    if not user:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    return user


def get_user_by_id(db: Session, user_id: str) -> Optional[User]:
    return db.query(User).filter(User.id == user_id, User.is_active == True).first()


def get_user_by_email(db: Session, email: str) -> Optional[User]:
    return db.query(User).filter(User.email == email).first()


# ─── Session Management ───────────────────────────────────────────────────────

def create_user_session(
    db: Session,
    user_id: str,
    refresh_token: str,
    ip_address: str | None,
    user_agent: str | None,
) -> UserSession:
    session = UserSession(
        user_id=user_id,
        refresh_token=refresh_token,
        expires_at=datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
        ip_address=ip_address,
        user_agent=user_agent,
        created_at=datetime.now(timezone.utc),
    )
    db.add(session)
    db.commit()
    return session


def get_session_by_refresh_token(db: Session, refresh_token: str) -> Optional[UserSession]:
    return (
        db.query(UserSession)
        .filter(
            UserSession.refresh_token == refresh_token,
            UserSession.expires_at > datetime.now(timezone.utc),
        )
        .first()
    )


def revoke_session(db: Session, refresh_token: str) -> None:
    db.query(UserSession).filter(UserSession.refresh_token == refresh_token).delete()
    db.commit()


def revoke_all_user_sessions(db: Session, user_id: str) -> None:
    db.query(UserSession).filter(UserSession.user_id == user_id).delete()
    db.commit()
