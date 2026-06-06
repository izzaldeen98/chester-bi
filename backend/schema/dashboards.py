from pydantic import BaseModel , Field
from datetime import datetime
from uuid import UUID
from typing import Optional

class DashboardBase(BaseModel):
    name: str = Field(..., min_length=3, max_length=127)
    description: str = Field(..., min_length=3, max_length=127)



class DashboardCreate(DashboardBase):
    pass



class DashboardUpdate(DashboardBase):
    name: Optional[str] = Field(None, min_length=3, max_length=127)
    description: Optional[str] = Field(None, min_length=3, max_length=127)
    config_file: Optional[str] = Field(None, min_length=3, max_length=127)
    is_active: Optional[bool] = Field(None)

class DashboardPublicResponse(BaseModel):
    public_key: UUID
    name: str
    description: str
    created_at: datetime
    updated_at: datetime
    created_by_public_key: Optional[UUID] = Field(None , serialize_alias="created_by")
    updated_by_public_key: Optional[UUID] = Field(None , serialize_alias="updated_by")

    class Config:
        from_attributes = True

