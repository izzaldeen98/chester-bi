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
    file_name = Column(String, nullable=False)
    package_id = Column(Integer, ForeignKey("packages.id"), nullable=False)

    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    updated_by = Column(Integer, ForeignKey("users.id"), nullable=False)

    package = relationship(
        "Package",
        foreign_keys=[package_id],
        backref="semantic_models"
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

