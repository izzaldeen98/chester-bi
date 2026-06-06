import uuid
from sqlalchemy import Column, Integer, String, DateTime, Boolean, JSON, ForeignKey, UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from utils.init_database import Base

class User(Base):
    __tablename__ = "users"
    
    # 🆔 Primary Keys & Core Identifiers
    id = Column(Integer, primary_key=True, index=True)
    # Passed uuid.uuid4 as a callable default (no parenthesis)
    public_key = Column(UUID, nullable=False, unique=True, index=True, default=uuid.uuid4)
    
    # 👤 Profile Information
    email = Column(String, unique=True, index=True, nullable=True)
    username = Column(String, nullable=False, unique=True, index=True)
    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=False)
    company_name = Column(String, nullable=True)
    hashed_password = Column(String, nullable=False)
    
    # 🛡️ Access Control & RBAC
    is_superuser = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    role = Column(String, nullable=False, default="user")
    permissions = Column(JSON, nullable=False, default=[])
    
    # 🏢 Tenancy Link (Points to your Accounts table)
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=True)

    # ⏱️ Automatic Timestamps
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    # 📑 Audit Trail Columns (Integers hold the actual SQL Foreign Keys)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    updated_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    # These store the UUIDs for quick frontend API consumption, but don't need FK constraints
    created_by_public_key = Column(UUID, nullable=True)
    updated_by_public_key = Column(UUID, nullable=True)

    # 🔗 Clean Self-Referential Relationships
    # This allows you to do: user.creator.username or user.updater.email
    creator = relationship(
        "User", 
        foreign_keys=[created_by], 
        backref="created_users", 
        remote_side=[id]
    )
    updater = relationship(
        "User", 
        foreign_keys=[updated_by], 
        backref="updated_users", 
        remote_side=[id]
    )
    
    # Account Multi-Tenant Link
    account = relationship(
        "Account", 
        foreign_keys=[account_id], 
        backref="account_users"
    )
