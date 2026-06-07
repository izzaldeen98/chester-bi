from pydantic import BaseModel , Field
from typing import Optional
from datetime import datetime
from uuid import UUID
from pydantic import ConfigDict



class ConnectionBase(BaseModel):
    name: str = Field(..., min_length=3)
    description: str = Field(..., min_length=3)
    type: str = Field(..., min_length=3)
    host: str = Field(..., min_length=3)
    port: int = Field(..., ge=1 , le=65535)
    username: str = Field(..., min_length=3)
    password: str = Field(..., min_length=3)
    namespace: Optional[str] = Field(None, min_length=3)
    schema: Optional[str] = Field(None, min_length=3)
    database: Optional[str] = Field(None, min_length=3)

class ConnectionCreate(ConnectionBase):
    pass

class ConnectionUpdate(ConnectionBase):
    pass

class ConnectionPublicResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID = Field(validation_alias="public_key")

    type: str
    name: str
    description: str
    host: str
    port: int
    username: str
    namespace: Optional[str] = None
    schema: Optional[str] = None
    database: Optional[str] = None

    created_at: datetime
    updated_at: datetime
    created_by: Optional[UUID] = Field(None, validation_alias="created_by_public_key")
    updated_by: Optional[UUID] = Field(None, validation_alias="updated_by_public_key")

    is_active: bool

class ConnectionTestResponse(BaseModel):
    message: str
    status: str
    data: Optional[dict] = None
    error: Optional[str] = None

    class Config:
        from_attributes = True


