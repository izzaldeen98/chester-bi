from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey, UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from utils.init_database import Base
import uuid

class Definition(Base):
    __tablename__ = "definitions"
    id = Column(Integer, primary_key=True, index=True)
    public_key = Column(UUID, nullable=False, unique=True, index=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    file_path = Column(String, nullable=False)
    file_name = Column(String, nullable=False)
    model_id = Column(Integer, ForeignKey("models.id"), nullable=False)

    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    updated_by = Column(Integer, ForeignKey("users.id"), nullable=False)

    model = relationship(
        "Model",
        foreign_keys=[model_id],
        backref="definitions"
    )
    creator = relationship(
        "User",
        foreign_keys=[created_by],
        backref="created_definitions"
    )
    updater = relationship(
        "User",
        foreign_keys=[updated_by],
        backref="updated_definitions"
    )
