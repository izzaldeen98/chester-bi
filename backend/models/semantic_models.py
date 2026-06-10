from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey, UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from utils.init_database import Base
import uuid

class SemanticModel(Base):
    __tablename__ = "semantic_models"
    id = Column(Integer, primary_key=True, index=True)
    public_key = Column(UUID, nullable=False, unique=True, index=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    file_path = Column(String, nullable=False)
    connection_id = Column(Integer, ForeignKey("connections.id"), nullable=False)
    connection_public_key = Column(UUID, nullable=False)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    updated_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_by_public_key = Column(UUID, nullable=False)
    updated_by_public_key = Column(UUID, nullable=False)
    connection = relationship(
        "Connection",
        foreign_keys=[connection_id],
        backref="cube_models"
    )
    creator = relationship(
        "User",
        foreign_keys=[created_by],
        backref="created_cube_models"
    )
    updater = relationship(
        "User",
        foreign_keys=[updated_by],
        backref="updated_cube_models"
    )

