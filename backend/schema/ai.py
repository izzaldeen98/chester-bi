from datetime import datetime
from typing import Any, Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field

Provider = Literal["openai", "anthropic", "gemini", "deepseek", "qwen"]


class AIProviderCreate(BaseModel):
    provider: Provider
    label: str = Field(..., min_length=2, max_length=63)
    api_key: str = Field(..., min_length=8)
    default_model: str = Field(..., min_length=1)   # picked once, used by every prompt
    base_url: Optional[str] = None
    models: Optional[list[str]] = None   # defaults to the adapter's curated list


class AIProviderUpdate(BaseModel):
    label: Optional[str] = Field(None, min_length=2, max_length=63)
    api_key: Optional[str] = Field(None, min_length=8)
    default_model: Optional[str] = Field(None, min_length=1)
    base_url: Optional[str] = None
    models: Optional[list[str]] = None
    is_active: Optional[bool] = None


class AIProviderResponse(BaseModel):
    """The API key itself is never returned — only api_key_hint."""
    id: UUID = Field(validation_alias="public_key")
    provider: str
    label: str
    api_key_hint: str
    base_url: Optional[str] = None
    default_model: Optional[str] = None
    models: list[str]
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class GenerateRequest(BaseModel):
    # Omit provider_id when the account has exactly one active provider — the
    # model comes from that provider's default_model either way.
    provider_id: Optional[UUID] = None
    semantic_model_id: UUID         # the Chester BI Model the agent reads
    theme: str = "chester"
    brief: str = Field(..., min_length=10)
    name: Optional[str] = Field(None, max_length=127)


class GenerateResponse(BaseModel):
    dashboard_id: UUID
    name: str
    element_count: int
    unmet: list[str] = []
    errors: list[str] = []


class ElementPromptRequest(BaseModel):
    provider_id: Optional[UUID] = None
    instruction: str = Field(..., min_length=3)
    theme: str = "chester"
    # Defaults to the model the edited component's dataset belongs to.
    semantic_model_id: Optional[UUID] = None


class ElementPromptResponse(BaseModel):
    element: dict[str, Any]
    errors: list[str] = []
    saved: bool
