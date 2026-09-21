import uuid
from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey, UUID, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from utils.init_database import Base


class Artifact(Base):
    """An LLM-authored, self-contained HTML analysis page.

    The artifact IS the markup: the model writes its own charts, narrative and
    filter controls. The file holds no data — on every render the backend
    re-runs the Cube queries in `queries` and injects the rows, so an artifact
    is never stale."""
    __tablename__ = "artifacts"

    id = Column(Integer, primary_key=True, index=True)
    public_key = Column(UUID, nullable=False, unique=True, index=True, default=uuid.uuid4)
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=False)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    theme = Column(String, nullable=False, default="chester")
    provider = Column(String, nullable=False)
    llm_model = Column(String, nullable=False)
    semantic_model_id = Column(Integer, ForeignKey("models.id"), nullable=True)
    # [{"id": "revenue_by_customer", "label": "...", "cube_query": {...}}] — the
    # agent's own Cube queries, validated against /meta before being stored.
    queries = Column(JSON, nullable=False, default=list)
    file_path = Column(String, nullable=False)          # folder; file is <public_key>.html
    # One entry per version: [{"version": 1, "instruction": "...", "at": iso8601,
    # "model": "..."}] — the brief, then each refinement. Every version's markup
    # is snapshotted next to the current file as <public_key>.v<n>.html.
    prompts = Column(JSON, nullable=False, default=list)
    current_version = Column(Integer, nullable=False, default=1)
    is_active = Column(Boolean, nullable=False, default=True)

    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    updated_by = Column(Integer, ForeignKey("users.id"), nullable=False)

    account = relationship("Account", foreign_keys=[account_id], backref="artifacts")
    semantic_model = relationship("Model", foreign_keys=[semantic_model_id], backref="artifacts")
    creator = relationship("User", foreign_keys=[created_by], backref="created_artifacts")
    updater = relationship("User", foreign_keys=[updated_by], backref="updated_artifacts")
