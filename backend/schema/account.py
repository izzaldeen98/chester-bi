from pydantic import BaseModel , Field
from datetime import datetime
from uuid import UUID
from pydantic import EmailStr
from typing import List


class AccountBase(BaseModel):
    name: str = Field(..., min_length=3, max_length=127)
    description: str = Field(..., min_length=3, max_length=127)


class AccountPublicResponse(AccountBase):
    id: UUID = Field(..., validation_alias="public_key")
    created_at: datetime
    updated_at: datetime

class OwnerCreate(AccountBase):
    username: str = Field(..., min_length=3, max_length=127)
    email: EmailStr = Field(..., min_length=3, max_length=127)
    password: str = Field(..., min_length=8)
    first_name: str = Field(..., min_length=3, max_length=127)
    last_name: str = Field(..., min_length=3, max_length=127)
    description: str = Field(..., min_length=3, max_length=127)
    name: str = Field(..., min_length=3, max_length=127)
    examples: List[str] = []



