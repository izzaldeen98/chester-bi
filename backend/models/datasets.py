from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey, UUID, ARRAY, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from utils.init_database import Base
import uuid


class Dataset(Base):
    __tablename__ = "datasets"
    id = Column(Integer, primary_key=True, index=True)
    public_key = Column(UUID, nullable=False, unique=True, index=True, default=uuid.uuid4)
    name = Column(String, nullable=False)

    # --- CHANGED TO JSON FOR SQLITE COMPATIBILITY ---
    aggregation_fields = Column(JSON, nullable=False)
    group_by_fields = Column(JSON, nullable=True)
    # ------------------------------------------------

    source = Column(String, nullable=False)

    filters = Column(JSON, nullable=True)
    havings = Column(JSON, nullable=True)
    calculated_fields = Column(JSON, nullable=True)
    order_by_fields = Column(JSON, nullable=True)
    limit = Column(Integer, nullable=True , default=1000)
    # Whether `limit` also applies when this dataset is read by a dashboard
    # widget — off means the editor still previews a limited sample (query
    # safety), but dashboards fetch the full, unlimited result.
    limit_enabled = Column(Boolean, nullable=False, default=True)
    description = Column(String, nullable=True)
    cube_query = Column(JSON, nullable=False)
    sql_query = Column(String, nullable=True)
    definition_id = Column(Integer, ForeignKey("definitions.id"), nullable=False)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    updated_by = Column(Integer, ForeignKey("users.id"), nullable=False)

    definition = relationship(
        "Definition",
        foreign_keys=[definition_id],
        backref="datasets"
    )
    creator = relationship(
        "User",
        foreign_keys=[created_by],
        backref="created_datasets"
    )
    updater = relationship(
        "User",
        foreign_keys=[updated_by],
        backref="updated_datasets"
    )
