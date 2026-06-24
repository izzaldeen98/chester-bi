from pydantic import BaseModel , Field , AliasPath
from uuid import UUID
from datetime import datetime
from fastapi import UploadFile

class File(BaseModel):
    id: UUID = Field(..., validation_alias="public_key")
    name: str
    description: str | None = None



class FilePublicResponse(BaseModel):
    id: UUID = Field(..., validation_alias="public_key")
    name: str
    description: str | None = None
    path: str
    extension: str
    file_size: int
    file_name: str
    created_at: datetime
    updated_at: datetime
    created_by: str = Field(validation_alias=AliasPath("creator", "username"))
    updated_by: str = Field(validation_alias=AliasPath("updater", "username"))

    class Config:
        from_attributes = True

class FileCreateRequest(BaseModel):
    name: str
    description: str | None = None
    file : UploadFile = ...

    class Config:
        from_attributes = True


