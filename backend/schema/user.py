from pydantic import UUID4, BaseModel , EmailStr , Field
from datetime import datetime
from typing import List , Optional
from uuid import UUID

from sqlalchemy.orm.writeonly import strategies

class UserBase(BaseModel):
    username : str = Field(..., min_length=3, max_length=127)
    first_name: str = Field(..., min_length=3, max_length=127)
    last_name: str = Field(..., min_length=3, max_length=127)



class UserCreate(UserBase):
    password: str = Field(..., min_length=8)

class UserUpdate(UserBase):
    password: Optional[str] = Field(..., min_length=8)

class UserUpdate(BaseModel):
    email: Optional[EmailStr] = Field(None)
    username: Optional[str] = Field(None , min_length=3, max_length=127)
    first_name: Optional[str] = Field(None , min_length=3, max_length=127)
    last_name: Optional[str] = Field(None , min_length=3, max_length=127)
    role: Optional[str] = Field(None)
    permissions: Optional[List[str]] = Field(None)
    is_active: Optional[bool] = Field(None)


class UserPublicResponse(UserBase):
    public_key: UUID
    is_active: bool
    role: str
    email : str | None = None
    permissions: List[str]
    created_at: datetime
    updated_at: datetime
    created_by_public_key: UUID | None = None
    updated_by_public_key: UUID | None = None

    class Config:
        from_attributes = True


class UserAdminResponse(UserPublicResponse):
    permissions: List[str]

    class Config:
        from_attributes = True




