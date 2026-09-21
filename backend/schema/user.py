from pydantic import UUID4, BaseModel , EmailStr , Field
from datetime import datetime
from typing import List , Optional
from uuid import UUID
from pydantic import AliasPath

from sqlalchemy.orm.writeonly import strategies
from enum import StrEnum

class UserPermissions(StrEnum):
    ARTIFACTS_LIST = "artifacts:list"
    ARTIFACTS_EDIT = "artifacts:edit"
    ARTIFACTS_DELETE = "artifacts:delete"
    ARTIFACTS_CREATE = "artifacts:create"
    ARTIFACTS_ALL = "artifacts:*"
    USERS_LIST = "users:list"
    USERS_EDIT = "users:edit"
    USERS_CREATE = "users:create"
    USERS_ALL = "users:*"
    CONNECTIONS_CREATE = "connections:create"
    CONNECTIONS_EDIT = "connections:edit"
    CONNECTIONS_DELETE = "connections:delete"
    CONNECTIONS_LIST = "connections:list"
    CONNECTIONS_ALL = "connections:*"
    DEFINITIONS_VIEW = "definitions:view"
    DEFINITIONS_EDIT = "definitions:edit"
    DEFINITIONS_DELETE = "definitions:delete"
    DEFINITIONS_CREATE = "definitions:create"
    DEFINITIONS_LIST = "definitions:list"
    DEFINITIONS_ALL = "definitions:*"
    MODELS_EDIT = "models:edit"
    MODELS_DELETE = "models:delete"
    MODELS_CREATE = "models:create"
    MODELS_LIST = "models:list"
    MODELS_ALL = "models:*"
    AI_MANAGE = "ai:manage"      # configure LLM providers / API keys
    AI_ALL = "ai:*"


class UserBase(BaseModel):
    username : str = Field(..., min_length=3, max_length=127)
    first_name: str = Field(..., min_length=3, max_length=127)
    last_name: str = Field(..., min_length=3, max_length=127)



class UserCreate(UserBase):
    password: Optional[str] = Field(None, min_length=6)
    permissions: Optional[List[UserPermissions]] = Field(None)


class UserUpdate(BaseModel):
    email: Optional[EmailStr] = Field(None)
    username: Optional[str] = Field(None , min_length=3, max_length=127)
    first_name: Optional[str] = Field(None , min_length=3, max_length=127)
    last_name: Optional[str] = Field(None , min_length=3, max_length=127)
    role: Optional[str] = Field(None)
    permissions: Optional[List[UserPermissions]] = Field(None)
    is_active: Optional[bool] = Field(None)
    is_password_set: Optional[bool] = Field(None)


class UserPublicResponse(UserBase):
    id: UUID = Field(validation_alias="public_key")
    is_active: bool
    role: str
    email : str | None = None
    permissions: List[str] | None = None
    created_at: datetime
    updated_at: datetime
    created_by: Optional[str] = Field(default=None, validation_alias=AliasPath("creator", "username"))
    updated_by: Optional[str] = Field(default=None, validation_alias=AliasPath("updater", "username"))

    class Config:
        from_attributes = True


class UserAdminResponse(UserPublicResponse):
    permissions: List[UserPermissions]

    class Config:
        from_attributes = True




