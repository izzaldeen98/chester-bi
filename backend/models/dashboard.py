import uuid
from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey, UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from utils.init_database import Base

class Dashboard(Base):
    __tablename__ = "dashboards"
    
    id = Column(Integer, primary_key=True, index=True)
    public_key = Column(UUID, nullable=False, unique=True, index=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    config_file = Column(String, nullable=False , unique=True) # Stores the path to your JSON layout file
    is_active = Column(Boolean, default=True)
    
    # Timestamps
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    
    # Foreign Keys
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=False)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    updated_by = Column(Integer, ForeignKey("users.id"), nullable=False)


    # ✅ FIXED: Changed to backref so you do NOT have to edit your Account model file
    account = relationship(
        "Account",
        foreign_keys=[account_id],
        backref="dashboards"
    )
    
    # 🔒 Kept back_populates here (Ensure User model has matching fields declared)
    creator = relationship(
        "User", 
        foreign_keys=[created_by], 
        backref="created_dashboards"
    )
    
    updater = relationship(
        "User", 
        foreign_keys=[updated_by], 
        backref="updated_dashboards"
    )
