from pydantic import BaseModel, Field
from uuid import UUID
from datetime import datetime

class CubeModelBase(BaseModel):
    name: str = Field(..., min_length=3)
    
    # 1. Fixed mutable default timestamp using default_factory
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    
    # 2. Removed invalid "min_length=3" validators from UUID types
    connection_id: UUID = Field(..., validation_alias="connection_public_key")
    created_by: int = Field(...)
    updated_by: int = Field(...)

    created_by_public_key: UUID = Field(...)
    updated_by_public_key: UUID = Field(...)

    # 3. Enables reading data directly from SQLAlchemy ORM models if needed

    

class CubeModelPublicResponse(BaseModel):
    id: UUID = Field(..., validation_alias="public_key")
    file_path: str
    name: str
    created_at: datetime
    updated_at: datetime
    created_by: UUID = Field(..., validation_alias="created_by_public_key")
    updated_by: UUID = Field(..., validation_alias="updated_by_public_key")
    connection_id: UUID = Field(..., validation_alias="connection_public_key")
