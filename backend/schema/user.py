from pydantic import UUID4, BaseModel , EmailStr , Field
from datetime import datetime
from typing import List , Optional
from uuid import UUID
from pydantic import AliasPath

from sqlalchemy.orm.writeonly import strategies
from enum import StrEnum

class UserPermissions(StrEnum):
    DASHBOARDS_LIST = "dashboards:list"
    DASHBOARDS_VIEW = "dashboards:view"
    DASHBOARDS_EDIT = "dashboards:edit"
    DASHBOARDS_DELETE = "dashboards:delete"
    DASHBOARDS_CREATE = "dashboards:create"
    DASHBOARDS_ALL = "dashboards:*"
    USERS_LIST = "users:list"
    USERS_EDIT = "users:edit"
    USERS_CREATE = "users:create"
    USERS_ALL = "users:*"
    CONNECTIONS_CREATE = "connections:create"
    CONNECTIONS_EDIT = "connections:edit"
    CONNECTIONS_DELETE = "connections:delete"
    CONNECTIONS_LIST = "connections:list"
    CONNECTIONS_ALL = "connections:*"
    MODELS_VIEW = "models:view"
    MODELS_EDIT = "models:edit"
    MODELS_DELETE = "models:delete"
    MODELS_CREATE = "models:create"
    MODELS_LIST = "models:list"
    MODELS_ALL = "models:*"
    PACKAGES_EDIT = "packages:edit"
    PACKAGES_DELETE = "packages:delete"
    PACKAGES_CREATE = "packages:create"
    PACKAGES_LIST = "packages:list"
    PACKAGES_ALL = "packages:*"


class UserBase(BaseModel):
    username : str = Field(..., min_length=3, max_length=127)
    first_name: str = Field(..., min_length=3, max_length=127)
    last_name: str = Field(..., min_length=3, max_length=127)



class UserCreate(UserBase):
    password: str = Field(..., min_length=8)
    permissions: Optional[List[UserPermissions]] = Field(None)


class UserUpdate(BaseModel):
    email: Optional[EmailStr] = Field(None)
    username: Optional[str] = Field(None , min_length=3, max_length=127)
    first_name: Optional[str] = Field(None , min_length=3, max_length=127)
    last_name: Optional[str] = Field(None , min_length=3, max_length=127)
    role: Optional[str] = Field(None)
    permissions: Optional[List[UserPermissions]] = Field(None)
    is_active: Optional[bool] = Field(None)


class UserPublicResponse(UserBase):
    id: UUID = Field(validation_alias="public_key")
    is_active: bool
    role: str
    email : str | None = None
    permissions: List[UserPermissions]
    created_at: datetime
    updated_at: datetime
    created_by: Optional[UUID] = Field(default=None, validation_alias=AliasPath("creator", "public_key"))
    updated_by: Optional[UUID] = Field(default=None, validation_alias=AliasPath("updater", "public_key"))

    class Config:
        from_attributes = True


class UserAdminResponse(UserPublicResponse):
    permissions: List[UserPermissions]

    class Config:
        from_attributes = True




