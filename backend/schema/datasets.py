from pydantic import BaseModel , AliasPath , Field
from uuid import UUID
from datetime import datetime
from typing import Literal, Optional, Any


class DatasetModel(BaseModel):
    id: UUID = Field(..., validation_alias="public_key")
    name: str = Field(..., validation_alias="name")

class DatasetDefinition(BaseModel):
    id: UUID = Field(..., validation_alias="public_key")
    name: str = Field(..., validation_alias="name")
    model: DatasetModel

class DatasetBase(BaseModel):
    id: UUID = Field(..., validation_alias="public_key")
    name: str
    description: str | None = None
    source: str
    definition: DatasetDefinition
    created_at: datetime
    updated_at: datetime
    created_by: str = Field(validation_alias=AliasPath("creator", "username"))
    updated_by: str = Field(validation_alias=AliasPath("updater", "username"))

class DatasetPublicResponse(DatasetBase):
    pass

class DatasetDetailedResponse(DatasetBase):
    source: str
    aggregation_fields: list[str]
    group_by_fields: list[str] | None = None
    filters: dict | None = None
    havings: dict | None = None
    calculated_fields: list | None = None
    order_by_fields: dict | None = None
    limit: int | None = 1000
    limit_enabled: bool = True
    cube_query: dict
    sql_query: str | None = None
    definition: DatasetDefinition

    class Config:
        from_attributes = True


class DatasetCreateRequest(BaseModel):
    name: str
    description: str | None = None
    source: str
    aggregation_fields: list[str]
    group_by_fields: list[str] | None = None
    filters: dict | None = None
    havings: dict | None = None
    calculated_fields: list | None = None
    order_by_fields: dict | None = None
    limit: int | None = 1000
    limit_enabled: bool = True
    cube_query: dict
    sql_query: str | None = None

    class Config:
        from_attributes = True

class DatasetUpdateRequest(BaseModel):
    name: str | None = None
    description: str | None = None
    source: str | None = None
    aggregation_fields: list[str] | None = None
    group_by_fields: list[str] | None = None
    filters: dict | None = None
    havings: dict | None = None
    calculated_fields: list | None = None
    order_by_fields: dict | None = None
    limit: int | None = 1000
    limit_enabled: bool = True
    cube_query: dict | None = None
    sql_query: str | None = None
    definition_id: UUID | None = None
