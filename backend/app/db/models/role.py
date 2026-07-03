# backend/app/db/models/role.py
from sqlalchemy import Integer, String, Text, ForeignKey, Table, Column
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .base import Base, TimestampMixin


class RolePermission(Base):
    __tablename__ = "role_permissions"

    role_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True
    )
    permission_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("permissions.id", ondelete="CASCADE"), primary_key=True
    )


class Permission(Base):
    __tablename__ = "permissions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    resource: Mapped[str] = mapped_column(String(50), nullable=False)
    action: Mapped[str] = mapped_column(String(50), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)

    roles: Mapped[list["Role"]] = relationship(
        "Role", secondary="role_permissions", back_populates="permissions"
    )

    def __repr__(self) -> str:
        return f"<Permission {self.name}>"


class Role(Base, TimestampMixin):
    __tablename__ = "roles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)

    permissions: Mapped[list[Permission]] = relationship(
        Permission, secondary="role_permissions", back_populates="roles",
        lazy="selectin"
    )
    users: Mapped[list["User"]] = relationship("User", back_populates="role")

    def has_permission(self, permission_name: str) -> bool:
        return any(p.name == permission_name for p in self.permissions)

    def __repr__(self) -> str:
        return f"<Role {self.name}>"
