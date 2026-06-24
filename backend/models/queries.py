from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey, UUID, ARRAY, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from utils.init_database import Base
import uuid


class Query(Base):
    __tablename__ = "queries"
    id = Column(Integer, primary_key=True, index=True)
    public_key = Column(UUID, nullable=False, unique=True, index=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    
    # --- CHANGED TO JSON FOR SQLITE COMPATIBILITY ---
    aggregation_fields = Column(JSON, nullable=False)
    group_by_fields = Column(JSON, nullable=True)
    # ------------------------------------------------

    source = Column(String, nullable=False)
    
    filters = Column(JSON, nullable=True)
    order_by_fields = Column(JSON, nullable=True)
    limit = Column(Integer, nullable=True , default=1000)
    description = Column(String, nullable=True)
    malloy_query = Column(String, nullable=False)
    sql_query = Column(String, nullable=True)
    semantic_model_id = Column(Integer, ForeignKey("semantic_models.id"), nullable=False)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    updated_by = Column(Integer, ForeignKey("users.id"), nullable=False)

    semantic_model = relationship(
        "SemanticModel",
        foreign_keys=[semantic_model_id],
        backref="queries"
    )
    creator = relationship(
        "User",
        foreign_keys=[created_by],
        backref="created_queries"
    )
    updater = relationship(
        "User",
        foreign_keys=[updated_by],
        backref="updated_queries"
    )
