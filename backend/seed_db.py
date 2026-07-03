#!/usr/bin/env python3
"""Seed database with initial roles and permissions."""
from datetime import datetime, timezone
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from app.core.config import settings
from app.db.models.role import Role, Permission
from app.db.models.user import User

engine = create_engine(settings.DATABASE_URL, echo=False)
SessionLocal = sessionmaker(bind=engine)

def seed_permissions(db):
    """Create all permissions."""
    permissions = [
        # Auth
        ("auth:login", "auth", "login", "User login"),
        ("auth:register", "auth", "register", "User registration"),
        ("auth:logout", "auth", "logout", "User logout"),
        # Documents
        ("documents:read", "documents", "read", "View documents"),
        ("documents:upload", "documents", "upload", "Upload documents"),
        ("documents:delete", "documents", "delete", "Delete documents"),
        # Chat
        ("chat:create", "chat", "create", "Create chat sessions"),
        ("chat:history", "chat", "history", "View chat history"),
        # Search
        ("search:perform", "search", "perform", "Perform search"),
        # Collections
        ("collections:create", "collections", "create", "Create collections"),
        ("collections:read", "collections", "read", "View collections"),
        ("collections:update", "collections", "update", "Update collections"),
        ("collections:delete", "collections", "delete", "Delete collections"),
        # Users (admin only)
        ("users:read", "users", "read", "View users"),
        ("users:update", "users", "update", "Update users"),
        ("users:delete", "users", "delete", "Delete users"),
        # Audit (admin only)
        ("audit:read", "audit", "read", "View audit logs"),
        # Dashboard
        ("dashboard:view", "dashboard", "view", "View dashboard"),
    ]
    
    for name, resource, action, desc in permissions:
        perm = db.query(Permission).filter_by(name=name).first()
        if not perm:
            perm = Permission(name=name, resource=resource, action=action, description=desc)
            db.add(perm)
            print(f"✅ Created permission: {name}")
        else:
            print(f"⏭️  Permission exists: {name}")
    
    db.commit()
    return db.query(Permission).all()

def seed_roles(db, permissions):
    """Create all roles and assign permissions."""
    now = datetime.now(timezone.utc)
    
    # Collect permissions by name for easier assignment
    perm_dict = {p.name: p for p in permissions}
    
    # Super Admin - full access
    super_admin_perms = [p.name for p in permissions]
    
    # Admin - most access except user deletion
    admin_perms = [
        "auth:login", "auth:logout", "documents:read", "documents:upload", 
        "documents:delete", "chat:create", "chat:history", "search:perform",
        "collections:create", "collections:read", "collections:update", "collections:delete",
        "users:read", "users:update", "audit:read", "dashboard:view"
    ]
    
    # Knowledge Manager - manage docs and collections
    km_perms = [
        "auth:login", "auth:logout", "documents:read", "documents:upload",
        "documents:delete", "chat:create", "chat:history", "search:perform",
        "collections:create", "collections:read", "collections:update", "collections:delete",
        "dashboard:view"
    ]
    
    # Editor - create and chat
    editor_perms = [
        "auth:login", "auth:logout", "documents:read", "documents:upload",
        "chat:create", "chat:history", "search:perform", "dashboard:view"
    ]
    
    # Viewer - read-only
    viewer_perms = [
        "auth:login", "auth:logout", "documents:read",
        "chat:create", "chat:history", "search:perform", "dashboard:view"
    ]
    
    roles_def = [
        ("super_admin", "Full system access", super_admin_perms),
        ("admin", "Administrator", admin_perms),
        ("knowledge_manager", "Knowledge Manager", km_perms),
        ("editor", "Editor", editor_perms),
        ("viewer", "Viewer (read-only)", viewer_perms),
    ]
    
    for role_name, description, perm_names in roles_def:
        role = db.query(Role).filter_by(name=role_name).first()
        if role:
            print(f"⏭️  Role exists: {role_name}")
            continue
        
        role = Role(
            name=role_name,
            description=description,
            created_at=now,
            updated_at=now,
        )
        
        for perm_name in perm_names:
            if perm_name in perm_dict:
                role.permissions.append(perm_dict[perm_name])
        
        db.add(role)
        print(f"✅ Created role: {role_name} with {len(perm_names)} permissions")
    
    db.commit()
    return db.query(Role).all()

def seed_admin_user(db):
    """Create default admin user."""
    from app.services.auth_service import hash_password
    
    admin = db.query(User).filter_by(email="admin@eka.local").first()
    if admin:
        print("⏭️  Admin user already exists")
        return
    
    admin_role = db.query(Role).filter_by(name="super_admin").first()
    if not admin_role:
        print("❌ Super admin role not found")
        return
    
    admin_user = User(
        email="admin@eka.local",
        username="admin",
        full_name="Administrator",
        hashed_password=hash_password("Admin@123"),
        role_id=admin_role.id,
        is_active=True,
        is_verified=True,
        department="Engineering",
    )
    db.add(admin_user)
    db.commit()
    print("✅ Created admin user: admin@eka.local / Admin@123")

if __name__ == "__main__":
    db = SessionLocal()
    try:
        print("\n🌱 Seeding database...\n")
        
        # Create permissions
        print("📋 Creating permissions...")
        perms = seed_permissions(db)
        print(f"   Total permissions: {len(perms)}\n")
        
        # Create roles
        print("👥 Creating roles...")
        roles = seed_roles(db, perms)
        print(f"   Total roles: {len(roles)}\n")
        
        # Create admin user
        print("🔐 Creating admin user...")
        seed_admin_user(db)
        
        print("\n✨ Database seeding complete!\n")
        
    except Exception as e:
        print(f"\n❌ Error: {e}\n")
        import traceback
        traceback.print_exc()
    finally:
        db.close()
