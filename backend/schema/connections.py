from pydantic import BaseModel , Field , AliasPath
from typing import Optional
from datetime import datetime
from uuid import UUID
from pydantic import ConfigDict
from typing import Optional



class ConnectionBase(BaseModel):
    name: str = Field(..., min_length=3)
    description: Optional[str] = None
    type: str = Field(..., min_length=3)

class ConnectionCreate(ConnectionBase):
    connection_attributes: dict = Field(..., min_length=3)

class ConnectionUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=3)
    description: Optional[str] = Field(None, min_length=3)
    connection_attributes: Optional[dict] = Field(None, min_length=3)

class ConnectionPublicResponse(BaseModel):
    id: UUID = Field(validation_alias="public_key")

    type: str
    name: str
    description: str | None = None
    created_at: datetime
    updated_at: datetime

    created_by: UUID = Field(validation_alias=AliasPath("creator", "public_key"))
    updated_by: UUID = Field(validation_alias=AliasPath("updater", "public_key"))

    is_active: bool

    model_config = ConfigDict(from_attributes=True)


class ConnectionTestResponse(BaseModel):
    message: str
    status: str
    data: Optional[dict] = None
    error: Optional[str] = None

    class Config:
        from_attributes = True


