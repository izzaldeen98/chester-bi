from pydantic import BaseModel, Field, AliasPath
from uuid import UUID
from datetime import datetime
from typing import Literal, Optional, Any


class SemanticModelBase(BaseModel):
    name: str = Field(..., min_length=3)
    description: str | None = Field(None, min_length=3)

    

    # 3. Enables reading data directly from SQLAlchemy ORM models if needed

    

class SemanticModelPublicResponse(BaseModel):
    id: UUID = Field(..., validation_alias="public_key")
    name: str
    description: str | None = None
    file_path: str
    file_name: str
    package_id: UUID = Field(..., validation_alias="package_public_key")
    created_at: datetime
    updated_at: datetime
    created_by: UUID = Field(validation_alias=AliasPath("creator", "public_key"))
    updated_by: UUID = Field(validation_alias=AliasPath("updater", "public_key"))


class SemanticModelFieldType(BaseModel):
    kind: str
    subtype: Optional[str] = None

class SemanticModelField(BaseModel):    
    name: str
    kind: Literal["dimension", "measure" , "join" , "view"]
    type: Optional[SemanticModelFieldType] = None

# New layer to map the nested JSON structure cleanly
class SchemaContainer(BaseModel):
    fields: list[SemanticModelField]

class SemanticModelSource(BaseModel):
    name: str
    kind: str
    # Maps the inner "schema": {"fields": [...]}
    source_schema: SchemaContainer = Field(..., alias="schema") 
    # Changed to Any to safely catch raw telemetry metadata arrays
    annotations: list[Any] = [] 

    class Config:
        populate_by_name = True

class SemanticModelSchema(BaseModel):
    type: str
    package_name: str
    model_path: Optional[str] = None
    malloy_version: str
    sources: list[SemanticModelSource]