from pydantic import BaseModel, Field
from uuid import UUID
from datetime import datetime

class SemanticModelBase(BaseModel):
    name: str = Field(..., min_length=3)
    description: str = Field(..., min_length=3)
    file_name: str = Field(..., min_length=3)
    
    # 1. Fixed mutable default timestamp using default_factory
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    
    # 2. Removed invalid "min_length=3" validators from UUID types
    connection_id: UUID = Field(..., validation_alias="connection_public_key")
    created_by: int = Field(...)
    updated_by: int = Field(...)


    # 3. Enables reading data directly from SQLAlchemy ORM models if needed

    

class SemanticModelPublicResponse(BaseModel):
    id: UUID = Field(..., validation_alias="public_key")
    file_path: str
    file_name: str
    name: str
    connection_id: UUID = Field(..., validation_alias="connection_public_key")
    created_at: datetime
    updated_at: datetime
    updated_by: UUID
    created_by: UUID
    
