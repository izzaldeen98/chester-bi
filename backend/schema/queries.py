from pydantic import BaseModel, AliasPath, Field
from uuid import UUID
from datetime import datetime


class QueryModel(BaseModel):
    id: UUID = Field(..., validation_alias="public_key")
    name: str = Field(..., validation_alias="name")


class QueryDefinition(BaseModel):
    id: UUID = Field(..., validation_alias="public_key")
    name: str = Field(..., validation_alias="name")
    model: QueryModel


class QueryBase(BaseModel):
    id: UUID = Field(..., validation_alias="public_key")
    name: str
    description: str | None = None
    source: str
    definition: QueryDefinition
    created_at: datetime
    updated_at: datetime
    created_by: str = Field(validation_alias=AliasPath("creator", "username"))
    updated_by: str = Field(validation_alias=AliasPath("updater", "username"))

    class Config:
        from_attributes = True


class QueryPublicResponse(QueryBase):
    pass


class QueryDetailedResponse(QueryBase):
    aggregation_fields: list[str]
    group_by_fields: list[str] | None = None
    filters: dict | None = None
    havings: dict | None = None
    order_by_fields: dict | None = None
    limit: int | None = 1000
    limit_enabled: bool = True
    cube_query: dict


class QueryCreateRequest(BaseModel):
    name: str
    description: str | None = None
    source: str
    aggregation_fields: list[str]
    group_by_fields: list[str] | None = None
    filters: dict | None = None
    havings: dict | None = None
    order_by_fields: dict | None = None
    limit: int | None = 1000
    limit_enabled: bool = True
    cube_query: dict


class QueryUpdateRequest(BaseModel):
    name: str | None = None
    description: str | None = None
    source: str | None = None
    aggregation_fields: list[str] | None = None
    group_by_fields: list[str] | None = None
    filters: dict | None = None
    havings: dict | None = None
    order_by_fields: dict | None = None
    limit: int | None = None
    limit_enabled: bool | None = None
    cube_query: dict | None = None
    definition_id: UUID | None = None
