from sqlalchemy import Column , Integer , String , DateTime , Boolean , JSON , ForeignKey , UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from utils.init_database import Base
import uuid

class Account(Base):
    __tablename__ = "accounts"
    id = Column(Integer, primary_key=True, index=True)
    public_key = Column(UUID, nullable=False , unique=True , index=True , default=uuid.uuid4)
    name = Column(String, nullable=False)
    description = Column(String, nullable=False)
    
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())


