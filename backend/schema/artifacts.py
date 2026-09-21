from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import AliasPath, BaseModel, Field


class ArtifactCreateRequest(BaseModel):
    # Omit provider_id when there is exactly one active provider. The LLM is
    # always that provider's default_model — chosen once, at setup.
    provider_id: Optional[UUID] = None
    semantic_model_id: UUID         # the Chester BI model the agent reads
    theme: str = "chester"
    brief: str = Field(..., min_length=10)
    name: Optional[str] = Field(None, max_length=127)


class ArtifactRefineRequest(BaseModel):
    provider_id: Optional[UUID] = None
    instruction: str = Field(..., min_length=3)


class ArtifactResponse(BaseModel):
    id: UUID = Field(validation_alias="public_key")
    name: str
    description: Optional[str] = None
    theme: str
    provider: str
    llm_model: str
    queries: list[dict] = []        # the agent's own Cube queries
    dataset_ids: list[str] = []     # legacy artifacts only
    prompts: list[dict] = []        # one entry per version
    current_version: int = 1
    # Not stored — set on the create response when the agent's brief could not be
    # fully answered, or a query matched no rows.
    warnings: list[str] = []
    created_at: datetime
    updated_at: datetime
    created_by: str = Field(validation_alias=AliasPath("creator", "username"))
    updated_by: str = Field(validation_alias=AliasPath("updater", "username"))

    class Config:
        from_attributes = True
