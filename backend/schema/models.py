from pydantic import BaseModel, Field , AliasPath
from uuid import UUID
from datetime import datetime

class ModelBase(BaseModel):
    name: str = Field(..., min_length=3)
    description: str | None = Field(None, min_length=3)

class ModelCreate(ModelBase):
    pass


class ModelUpdate(ModelBase):
    pass

class ModelResponse(BaseModel):
    id: UUID = Field(..., validation_alias="public_key")
    name : str
    location : str
    created_at: datetime
    updated_at: datetime
    created_by: str = Field(validation_alias=AliasPath("creator", "username"))
    updated_by: str = Field(validation_alias=AliasPath("updater", "username"))
    is_active: bool
