from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey, UUID, BigInteger
from sqlalchemy.orm import relationship , validates
from sqlalchemy.sql import func
from utils.init_database import Base
import uuid
import re

class File(Base):
    __tablename__ = "files"
    id = Column(Integer, primary_key=True, index=True)
    public_key = Column(UUID, nullable=False, unique=True, index=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    extension = Column(String, nullable=False)
    file_size = Column(BigInteger, nullable=False)
    description = Column(String, nullable=True)
    path = Column(String, nullable=False)
    file_name = Column(String, nullable=False)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    updated_by = Column(Integer, ForeignKey("users.id"), nullable=False)

    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=False)
    account = relationship(
        "Account",
        foreign_keys=[account_id],
        backref="files"
    )
    creator = relationship(
        "User",
        foreign_keys=[created_by],
        backref="created_files"
    )
    updater = relationship(
        "User",
        foreign_keys=[updated_by],
        backref="updated_files"
    )

    @validates("extension")
    def validate_extension(self, key, extension):
        if extension not in ["csv" , "xlsx" , "json" ,"parquet" ]:
            raise ValueError("Invalid extension")
        return extension

    @validates("file_size")
    def validate_file_size(self, key, file_size):
        if file_size < 0:
            raise ValueError("File size cannot be negative")
        if file_size > 1000000000:
            raise ValueError("File size cannot be greater than 1GB")
        return file_size
    @validates("file_name")
    def validate_file_name(self, key, file_name):
        if file_name is None:
            raise ValueError("File name cannot be None")
        
        # Allows only alphanumeric characters, underscores, and dots (no spaces or hyphens)
        if not re.match(r"^[\w.]+$", file_name):
            raise ValueError("File name can only contain letters, numbers, underscores, and dots")
            
        return file_name