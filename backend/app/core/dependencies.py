# backend/app/core/dependencies.py
"""
FastAPI dependency injection:
- get_current_user: decodes JWT, returns User
- require_permission: RBAC guard decorator
- require_roles: role-based guard
"""
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.db.models.user import User
from app.services.auth_service import decode_access_token, get_user_by_id

bearer_scheme = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_access_token(credentials.credentials)
        user_id: str = payload.get("sub")
        if not user_id:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = get_user_by_id(db, user_id)
    if not user:
        raise credentials_exception
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return user


def require_permission(permission_name: str):
    """Factory: returns a FastAPI dependency that checks a single permission."""
    async def _check(current_user: User = Depends(get_current_user)) -> User:
        if not current_user.has_permission(permission_name):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission denied: {permission_name}",
            )
        return current_user
    return _check


def require_roles(*role_names: str):
    """Factory: returns a dependency that allows only specific roles."""
    async def _check(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role.name not in role_names:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient role",
            )
        return current_user
    return _check
