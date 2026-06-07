from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey, UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from utils.init_database import Base
import uuid

class Connection(Base):
    __tablename__ = "connections"
    id = Column(Integer, primary_key=True, index=True)
    public_key = Column(UUID, nullable=False, unique=True, index=True, default=uuid.uuid4)
    type = Column(String, nullable=False)
    name = Column(String, nullable=False )
    description = Column(String, nullable=True)
    host = Column(String, nullable=False)
    port = Column(Integer, nullable=False)
    username = Column(String, nullable=False)
    password = Column(String, nullable=False)
    namespace = Column(String, nullable=True)
    schema = Column(String, nullable=True)
    database = Column(String, nullable=True)

    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=False)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    updated_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_by_public_key = Column(UUID, nullable=False)
    updated_by_public_key = Column(UUID, nullable=False)


    is_active = Column(Boolean, default=True)

    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    account = relationship(
        "Account",
        foreign_keys=[account_id],
        backref="connections"
    )

    creator = relationship(
        "User",
        foreign_keys=[created_by],
        backref="created_connections"
    )

    updater = relationship(
        "User",
        foreign_keys=[updated_by],
        backref="updated_connections"
    )