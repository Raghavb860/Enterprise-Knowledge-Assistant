# backend/app/db/repositories/user_repository.py
"""
User Repository
Encapsulates all database queries for the User model.
Keeps API layer clean of SQLAlchemy concerns.
"""
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.db.models.user import User
from app.db.models.role import Role


class UserRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, user_id: str) -> Optional[User]:
        return self.db.query(User).filter_by(id=user_id, is_active=True).first()

    def get_by_email(self, email: str) -> Optional[User]:
        return self.db.query(User).filter_by(email=email).first()

    def get_by_username(self, username: str) -> Optional[User]:
        return self.db.query(User).filter_by(username=username).first()

    def list(
        self,
        page: int = 1,
        page_size: int = 20,
        role_name: Optional[str] = None,
        is_active: Optional[bool] = None,
    ) -> tuple[list[User], int]:
        q = self.db.query(User)
        if role_name:
            q = q.join(Role).filter(Role.name == role_name)
        if is_active is not None:
            q = q.filter(User.is_active == is_active)
        total = q.count()
        items = q.order_by(User.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
        return items, total

    def create(self, **kwargs) -> User:
        user = User(**kwargs)
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        return user

    def update(self, user: User, **kwargs) -> User:
        for k, v in kwargs.items():
            if hasattr(user, k):
                setattr(user, k, v)
        self.db.commit()
        self.db.refresh(user)
        return user

    def deactivate(self, user: User) -> None:
        user.is_active = False
        self.db.commit()

    def count_active(self) -> int:
        return self.db.query(func.count(User.id)).filter_by(is_active=True).scalar()


# backend/app/db/repositories/document_repository.py
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from app.db.models.document import Document, DocumentStatus, FileType


class DocumentRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, doc_id: str) -> Optional[Document]:
        return self.db.query(Document).filter_by(id=doc_id, is_deleted=False).first()

    def get_by_hash(self, file_hash: str) -> Optional[Document]:
        return self.db.query(Document).filter_by(file_hash=file_hash, is_deleted=False).first()

    def list(
        self,
        page: int = 1,
        page_size: int = 20,
        owner_id: Optional[str] = None,
        collection_id: Optional[str] = None,
        department: Optional[str] = None,
        status: Optional[DocumentStatus] = None,
        file_type: Optional[FileType] = None,
        search: Optional[str] = None,
    ) -> tuple[list[Document], int]:
        q = self.db.query(Document).filter(Document.is_deleted == False)
        if owner_id:
            q = q.filter(Document.owner_id == owner_id)
        if collection_id:
            q = q.filter(Document.collection_id == collection_id)
        if department:
            q = q.filter(Document.department == department)
        if status:
            q = q.filter(Document.status == status)
        if file_type:
            q = q.filter(Document.file_type == file_type)
        if search:
            q = q.filter(or_(
                Document.original_name.contains(search),
                Document.title.contains(search),
                Document.description.contains(search),
            ))
        total = q.count()
        items = q.order_by(Document.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
        return items, total

    def create(self, **kwargs) -> Document:
        doc = Document(**kwargs)
        self.db.add(doc)
        self.db.commit()
        self.db.refresh(doc)
        return doc

    def soft_delete(self, doc: Document) -> None:
        from datetime import datetime, timezone
        doc.is_deleted = True
        doc.deleted_at = datetime.now(timezone.utc)
        self.db.commit()

    def count_by_status(self) -> dict:
        rows = (
            self.db.query(Document.status, func.count(Document.id))
            .filter(Document.is_deleted == False)
            .group_by(Document.status)
            .all()
        )
        return {str(status): count for status, count in rows}

    def count_by_type(self) -> dict:
        rows = (
            self.db.query(Document.file_type, func.count(Document.id))
            .filter(Document.is_deleted == False)
            .group_by(Document.file_type)
            .all()
        )
        return {str(ft): count for ft, count in rows}

    def total_count(self) -> int:
        return self.db.query(func.count(Document.id)).filter(Document.is_deleted == False).scalar()


# backend/app/db/repositories/collection_repository.py
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from app.db.models.collection import Collection


class CollectionRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, col_id: str) -> Optional[Collection]:
        return self.db.query(Collection).filter_by(id=col_id).first()

    def list(
        self,
        page: int = 1,
        page_size: int = 20,
        owner_id: Optional[str] = None,
        include_public: bool = True,
    ) -> tuple[list[Collection], int]:
        q = self.db.query(Collection)
        if owner_id and not include_public:
            q = q.filter(Collection.owner_id == owner_id)
        elif owner_id:
            q = q.filter(or_(Collection.owner_id == owner_id, Collection.is_public == True))
        total = q.count()
        items = q.order_by(Collection.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
        return items, total

    def create(self, **kwargs) -> Collection:
        col = Collection(**kwargs)
        self.db.add(col)
        self.db.commit()
        self.db.refresh(col)
        return col

    def update(self, col: Collection, **kwargs) -> Collection:
        for k, v in kwargs.items():
            if hasattr(col, k):
                setattr(col, k, v)
        self.db.commit()
        self.db.refresh(col)
        return col

    def delete(self, col: Collection) -> None:
        self.db.delete(col)
        self.db.commit()

    def increment_doc_count(self, col_id: str, delta: int = 1) -> None:
        col = self.get_by_id(col_id)
        if col:
            col.doc_count = max(0, col.doc_count + delta)
            self.db.commit()

    def total_count(self) -> int:
        return self.db.query(func.count(Collection.id)).scalar()
