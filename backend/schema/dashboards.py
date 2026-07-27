from pydantic import BaseModel , Field , AliasPath
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

class DashboardPublicResponse(BaseModel):
    id: UUID = Field(validation_alias="public_key")
    name: str
    description: str
    created_at: datetime
    updated_at: datetime
    created_by : str = Field( validation_alias=AliasPath("creator", "username"))
    updated_by : str = Field( validation_alias=AliasPath("updater", "username"))
    config_file: str

    class Config:
        from_attributes = True



