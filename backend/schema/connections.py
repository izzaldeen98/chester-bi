from pydantic import BaseModel , Field
from typing import Optional
from datetime import datetime
from uuid import UUID



class ConnectionBase(BaseModel):
    name: str = Field(..., min_length=3)
    description: str = Field(..., min_length=3)
    host: str = Field(..., min_length=3)
    port: int = Field(..., min_length=3)
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
    public_key: UUID = Field(..., alias="id")
    name: str
    description: str
    host: str
    port: int
    username: str
    password: Field(..., min_length=3, format="password")
    namespace: Optional[str]
    schema: Optional[str]
    database: Optional[str]
    
    created_at: datetime
    updated_at: datetime
    created_by_public_key: Optional[UUID] = Field(None, alias="created_by")
    updated_by_public_key: Optional[UUID] = Field(None, alias="updated_by")


class ConnectionTestResponse(BaseModel):
    message: str
    status: str
    data: Optional[dict] = None
    error: Optional[str] = None

    class Config:
        from_attributes = True


