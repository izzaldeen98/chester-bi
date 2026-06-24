from pydantic import BaseModel , AliasPath , Field
from uuid import UUID
from datetime import datetime
from typing import Literal, Optional, Any


class QueryPackage(BaseModel):
    id: UUID = Field(..., validation_alias="public_key")
    name: str = Field(..., validation_alias="name")

class QuerySemanticModel(BaseModel):
    id: UUID = Field(..., validation_alias="public_key")
    name: str = Field(..., validation_alias="name")
    package: QueryPackage

class QueryBase(BaseModel):
    id: UUID = Field(..., validation_alias="public_key")
    name: str
    description: str | None = None
    source: str
    semantic_model: QuerySemanticModel
    created_at: datetime
    updated_at: datetime
    created_by: str = Field(validation_alias=AliasPath("creator", "username"))
    updated_by: str = Field(validation_alias=AliasPath("updater", "username"))

class QueryPublicResponse(QueryBase):
    pass

class QueryDetailedResponse(QueryBase):
    source: str
    aggregation_fields: list[str]
    group_by_fields: list[str] | None = None
    filters: dict | None = None
    order_by_fields: dict | None = None
    limit: int | None = 1000
    malloy_query: str
    sql_query: str | None = None
    semantic_model: QuerySemanticModel

    class Config:
        from_attributes = True


class QueryCreateRequest(BaseModel):
    name: str
    description: str | None = None
    source: str
    aggregation_fields: list[str]
    group_by_fields: list[str] | None = None
    filters: dict | None = None
    order_by_fields: dict | None = None
    limit: int | None = 1000
    malloy_query: str
    sql_query: str | None = None
    
    class Config:
        from_attributes = True

class QueryUpdateRequest(BaseModel):
    name: str | None = None
    description: str | None = None
    source: str | None = None
    aggregation_fields: list[str] | None = None
    group_by_fields: list[str] | None = None
    filters: dict | None = None
    order_by_fields: dict | None = None
    limit: int | None = 1000
    malloy_query: str | None = None
    sql_query: str | None = None
    semantic_model_id: UUID | None = None