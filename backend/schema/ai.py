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
