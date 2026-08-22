from pydantic import BaseModel, Field, AliasPath
from uuid import UUID
from datetime import datetime
from typing import Optional


class DefinitionBase(BaseModel):
    name: str = Field(..., min_length=3)
    description: str | None = Field(None, min_length=3)

class DefinitionPublicResponse(BaseModel):
    id: UUID = Field(..., validation_alias="public_key")
    name: str
    description: str | None = None
    file_path: str
    file_name: str
    model_id: UUID = Field(..., validation_alias="model_public_key")
    created_at: datetime
    updated_at: datetime
    created_by: str = Field(validation_alias=AliasPath("creator", "username"))
    updated_by: str = Field(validation_alias=AliasPath("updater", "username"))


# Normalized shape the query-builder UI consumes — deliberately kept
# identical to what it already expected from Malloy's SourceInfo/FieldInfo
# ({sources: [{name, schema: {fields: [{name, kind, type}]}}]}) so the
# frontend's field-tree/filter-builder code doesn't need to change shape,
# only where its data comes from. utils/cube.py's normalize_meta() builds
# this from Cube's raw GET /cubejs-api/v1/meta response — see that function
# for the field-kind/type mapping. Unlike Malloy, joined cubes are never
# nested here: a join just makes another top-level cube's fields addressable
# as "OtherCube.field" in a query, so no join-field recursion is needed.
class DefinitionFieldType(BaseModel):
    kind: str

class DefinitionField(BaseModel):
    name: str
    kind: str  # "dimension" | "measure"
    type: Optional[DefinitionFieldType] = None

class SchemaContainer(BaseModel):
    fields: list[DefinitionField]

class DefinitionSource(BaseModel):
    name: str
    schema: SchemaContainer

class DefinitionSchema(BaseModel):
    sources: list[DefinitionSource]
