from pydantic import BaseModel, Field, AliasPath
from uuid import UUID
from datetime import datetime

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

class SemanticModelField(BaseModel):    
    name: str
    type: str
    datatype: str

class SemanticModelSource(BaseModel):
    name: str
    fields: list[SemanticModelField]

class SemanticModelSchema(BaseModel):
    type: str
    package_name: str
    model_path: str | None = None
    malloy_version: str
    schema : list[SemanticModelSource]
    
