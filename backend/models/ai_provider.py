import uuid
from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, ForeignKey, UUID, JSON, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from utils.init_database import Base


class AIProvider(Base):
    """One configured LLM provider + API key for an account. The key is stored
    Fernet-encrypted (security.encrypt_password, same FERNET_KEY as connection
    secrets) and only `api_key_hint` ever leaves the backend."""
    __tablename__ = "ai_providers"
    __table_args__ = (UniqueConstraint("account_id", "label", name="uq_ai_provider_label"),)

    id = Column(Integer, primary_key=True, index=True)
    public_key = Column(UUID, nullable=False, unique=True, index=True, default=uuid.uuid4)
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=False)
    provider = Column(String, nullable=False)          # openai | anthropic | gemini
    label = Column(String, nullable=False)
    api_key_enc = Column(String, nullable=False)
    api_key_hint = Column(String, nullable=False)      # "sk-...ab12"
    base_url = Column(String, nullable=True)
    models = Column(JSON, nullable=False, default=list)
    # The model every prompt uses. Chosen once when the provider is added, so
    # generating and refining never ask again.
    default_model = Column(String, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)

    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)

    account = relationship("Account", foreign_keys=[account_id], backref="ai_providers")
    creator = relationship("User", foreign_keys=[created_by], backref="created_ai_providers")


class DashboardAgentEdit(Base):
    """Append-only audit of every agent write to a dashboard config. `before_json`
    is null for generation; reverting an edit means writing before_json back into
    the config file's elements[]."""
    __tablename__ = "dashboard_agent_edits"

    id = Column(Integer, primary_key=True, index=True)
    dashboard_id = Column(Integer, ForeignKey("dashboards.id", ondelete="CASCADE"), nullable=False, index=True)
    element_id = Column(String, nullable=True)         # null = whole-dashboard generation
    instruction = Column(Text, nullable=False)
    before_json = Column(JSON, nullable=True)
    after_json = Column(JSON, nullable=False)
    provider = Column(String, nullable=False)
    model = Column(String, nullable=False)
    created_at = Column(DateTime, default=func.now())
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)

    dashboard = relationship("Dashboard", foreign_keys=[dashboard_id], backref="agent_edits")
    creator = relationship("User", foreign_keys=[created_by], backref="dashboard_agent_edits")
