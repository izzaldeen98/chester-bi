from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey, UUID, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from utils.init_database import Base
import uuid


class SavedQuery(Base):
    """A query a person built by hand against one semantic model.

    Deliberately invisible to the AI: nothing in backend/ai/ or the artifact
    routes reads this table, and the artifact agent is grounded only on Cube's
    compiled /meta. A query saved here is the author's own working material —
    it is not training input, not grounding, and not context for generation.
    utils/test_queries.py enforces that as a structural rule rather than a
    convention someone has to remember.
    """
    __tablename__ = "queries"

    id = Column(Integer, primary_key=True, index=True)
    public_key = Column(UUID, nullable=False, unique=True, index=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)

    # Which cube/view of the semantic model the query reads.
    source = Column(String, nullable=False)

    # The builder's own state, so reopening a saved query restores the exact
    # UI it was built in rather than a guess reverse-engineered from the
    # compiled Cube query.
    aggregation_fields = Column(JSON, nullable=False)
    group_by_fields = Column(JSON, nullable=True)
    filters = Column(JSON, nullable=True)
    havings = Column(JSON, nullable=True)
    order_by_fields = Column(JSON, nullable=True)
    limit = Column(Integer, nullable=True, default=1000)
    limit_enabled = Column(Boolean, nullable=False, default=True)

    # What actually runs. Built from the fields above by the frontend's
    # CubeQueryBuilder and re-validated server-side before it reaches Cube.
    cube_query = Column(JSON, nullable=False)

    definition_id = Column(Integer, ForeignKey("definitions.id"), nullable=False)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    updated_by = Column(Integer, ForeignKey("users.id"), nullable=False)

    definition = relationship("Definition", foreign_keys=[definition_id], backref="queries")
    creator = relationship("User", foreign_keys=[created_by], backref="created_queries")
    updater = relationship("User", foreign_keys=[updated_by], backref="updated_queries")
