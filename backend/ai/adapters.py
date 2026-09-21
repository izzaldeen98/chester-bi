"""Provider adapters — one class per LLM vendor, normalized to a single call:

    adapter.generate(system: str, user: str, model: str) -> str   # raw text

ponytail: plain `requests` against each vendor's REST endpoint instead of three
SDKs. All three are one POST with a JSON body; the SDKs would add ~40MB of
transitive deps to send it. Swap an adapter's body for its SDK if you ever need
streaming, tool calls or retries-with-backoff — the interface doesn't change.

Adding a provider = subclass ProviderAdapter, add it to ADAPTERS and MODELS.
"""
from abc import ABC, abstractmethod

import os

import requests

# Writing a 30KB page is a minutes-long request on a reasoning model (gpt-5,
# o-series, deep-thinking Gemini) — 120s cut them off mid-answer. Listing models
# is a plain GET and should fail fast instead.
TIMEOUT = int(os.getenv("LLM_TIMEOUT", "600"))
LIST_TIMEOUT = int(os.getenv("LLM_LIST_TIMEOUT", "30"))


# Token usage of the last call on each adapter instance: {"in", "out", "reasoning"}.
# Reasoning tokens are invisible but billed as output — on a reasoning model they
# are usually the largest single line on the bill, so they have to be measurable.
EMPTY_USAGE = {"in": 0, "out": 0, "reasoning": 0}


class ProviderError(Exception):
    """Carries the provider's status and body so callers can react to a specific
    rejection instead of string-matching a formatted message."""

    def __init__(self, name: str, status: int, body: str):
        self.status = status
        self.body = body
        super().__init__(f"{name} call failed ({status}): {body[:500]}")


# Every provider's model list is full of ids that cannot answer a chat request.
# One substring blocklist beats five per-provider filters.
_NOT_CHAT = (
    "embed", "tts", "whisper", "audio", "transcribe", "image", "dall-e", "moderation",
    "rerank", "video", "veo", "imagen", "lyria", "banana", "robotics", "computer-use",
    "guard", "search-", "realtime", "-vision",
)


def is_chat_model(model_id: str) -> bool:
    low = model_id.lower()
    return not any(bad in low for bad in _NOT_CHAT)


class ProviderAdapter(ABC):
    base_url: str = ""

    def __init__(self, api_key: str, base_url: str | None = None):
        self.api_key = api_key
        self.usage = dict(EMPTY_USAGE)      # last call
        self.total = dict(EMPTY_USAGE)      # this adapter's whole run
        if base_url:
            self.base_url = base_url.rstrip("/")

    def _record(self, usage: dict) -> None:
        self.usage = usage
        for k in self.total:
            self.total[k] += usage.get(k, 0)

    @abstractmethod
    def generate(self, system: str, user: str, model: str, json_mode: bool = True,
                 effort: str | None = None) -> str:
        """Returns the model's raw text response. Raises on transport/API error.

        json_mode asks the provider to constrain output to a JSON object. Turn it
        OFF when the answer is a long document (an HTML page): forcing it through
        a JSON string field means escaping the whole document, and one bad
        backslash makes the entire response unparseable.

        effort ("low" | "high" | None) hints how much hidden reasoning to spend.
        Reasoning tokens are billed as output and dominate the cost on gpt-5 and
        friends, so a mechanical turn (emit HTML from a finished plan) should ask
        for "low" while a judgement turn (choose measures and joins) asks for
        "high". Providers without a reasoning dial ignore it."""

    def available_models(self) -> list[str]:
        """Model ids this key can actually use, from the provider's own models
        endpoint. Raises on transport/API error; callers fall back to MODELS.
        Providers retire ids (a curated list goes stale and 404s), so this is
        the authoritative answer."""
        raise NotImplementedError

    def _get(self, url: str, headers: dict, params: dict | None = None) -> dict:
        try:
            res = requests.get(url, headers=headers, params=params, timeout=LIST_TIMEOUT)
        except requests.exceptions.RequestException as exc:
            raise Exception(f"{self.__class__.__name__}: could not reach {url} ({type(exc).__name__})")
        if res.status_code != 200:
            raise Exception(f"{self.__class__.__name__} model list failed ({res.status_code}): {res.text[:300]}")
        return res.json()

    def _post(self, url: str, headers: dict, body: dict) -> dict:
        try:
            res = requests.post(url, json=body, headers=headers, timeout=TIMEOUT)
        except requests.exceptions.Timeout:
            # Never retried: the provider may well have finished the work and
            # billed for it — we just stopped listening. Waiting longer is the
            # fix, not asking again.
            raise Exception(
                f"{self.__class__.__name__}: the model did not answer within {TIMEOUT}s. "
                f"Reasoning models are slow on long pages — raise LLM_TIMEOUT in .env, "
                f"or pick a faster model for this provider."
            )
        except requests.exceptions.RequestException as exc:
            raise Exception(
                f"{self.__class__.__name__}: could not reach the provider ({type(exc).__name__})"
            )
        if res.status_code != 200:
            raise ProviderError(self.__class__.__name__, res.status_code, res.text)
        return res.json()


class OpenAIAdapter(ProviderAdapter):
    base_url = "https://api.openai.com/v1"

    def generate(self, system: str, user: str, model: str, json_mode: bool = True,
                 effort: str | None = None) -> str:
        body = {
            "model": model,
            "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
            "temperature": 0,
        }
        if effort:
            # Ignored by non-reasoning models; a 400 here is handled below the
            # same way the temperature rejection is.
            body["reasoning_effort"] = effort
        if json_mode:
            body["response_format"] = {"type": "json_object"}
            # OpenAI rejects json_object mode unless the word "json" appears in
            # the messages. Every real prompt says it already; this covers the
            # short ones (the provider test ping) without touching them.
            if "json" not in f"{system}\n{user}".lower():
                body["messages"][0]["content"] += "\n\nRespond with a JSON object."
        headers = {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}
        url = f"{self.base_url}/chat/completions"
        try:
            data = self._post(url, headers, body)
        except ProviderError as exc:
            # Reasoning models (gpt-5, o-series) accept only the default
            # temperature; older models reject reasoning_effort. Retry on the
            # provider's own say-so rather than maintaining a list of which
            # models are which — that list rots.
            if exc.status != 400:
                raise
            dropped = False
            for param in ("temperature", "reasoning_effort"):
                if param in exc.body and param in body:
                    body.pop(param)
                    dropped = True
            if not dropped:
                raise
            data = self._post(url, headers, body)
        usage = data.get("usage") or {}
        self._record({
            "in": usage.get("prompt_tokens", 0),
            "out": usage.get("completion_tokens", 0),
            "reasoning": (usage.get("completion_tokens_details") or {}).get("reasoning_tokens", 0),
        })
        return data["choices"][0]["message"]["content"]

    def available_models(self) -> list[str]:
        data = self._get(f"{self.base_url}/models",
                         {"Authorization": f"Bearer {self.api_key}"})
        return sorted(m["id"] for m in data.get("data", []) if is_chat_model(m["id"]))


class DeepSeekAdapter(OpenAIAdapter):
    """DeepSeek serves the OpenAI chat/completions shape verbatim, JSON mode
    included — only the host differs."""
    base_url = "https://api.deepseek.com/v1"


class QwenAdapter(OpenAIAdapter):
    """Alibaba's DashScope "compatible-mode" endpoint is likewise OpenAI-shaped.
    This is the international host; set base_url on the provider row to
    https://dashscope.aliyuncs.com/compatible-mode/v1 for the mainland China
    region."""
    base_url = "https://dashscope-intl.aliyuncs.com/compatible-mode/v1"


class AnthropicAdapter(ProviderAdapter):
    base_url = "https://api.anthropic.com/v1"

    def generate(self, system: str, user: str, model: str, json_mode: bool = True,
                 effort: str | None = None) -> str:
        data = self._post(
            f"{self.base_url}/messages",
            {
                "x-api-key": self.api_key,
                "anthropic-version": "2023-06-01",
                "Content-Type": "application/json",
            },
            {
                "model": model,
                "max_tokens": 8192,
                "temperature": 0,
                "system": system,
                "messages": [{"role": "user", "content": user}],
            },
        )
        usage = data.get("usage") or {}
        self._record({"in": usage.get("input_tokens", 0),
                      "out": usage.get("output_tokens", 0), "reasoning": 0})
        return "".join(block.get("text", "") for block in data.get("content", []))

    def available_models(self) -> list[str]:
        data = self._get(
            f"{self.base_url}/models",
            {"x-api-key": self.api_key, "anthropic-version": "2023-06-01"},
            {"limit": 100},
        )
        return sorted(m["id"] for m in data.get("data", []) if is_chat_model(m["id"]))


class GeminiAdapter(ProviderAdapter):
    base_url = "https://generativelanguage.googleapis.com/v1beta"

    def generate(self, system: str, user: str, model: str, json_mode: bool = True,
                 effort: str | None = None) -> str:
        config = {"temperature": 0}
        if json_mode:
            config["responseMimeType"] = "application/json"
        if effort == "low":
            # Gemini spends "thought" tokens unless told otherwise; -1 is dynamic,
            # 0 disables. Only the cheap direction is worth asking for — the
            # default already reasons when it helps.
            config["thinkingConfig"] = {"thinkingBudget": 0}
        data = self._post(
            f"{self.base_url}/models/{model}:generateContent",
            {"x-goog-api-key": self.api_key, "Content-Type": "application/json"},
            {
                "systemInstruction": {"parts": [{"text": system}]},
                "contents": [{"role": "user", "parts": [{"text": user}]}],
                "generationConfig": config,
            },
        )
        usage = data.get("usageMetadata") or {}
        self._record({
            "in": usage.get("promptTokenCount", 0),
            "out": usage.get("candidatesTokenCount", 0),
            "reasoning": usage.get("thoughtsTokenCount", 0),
        })
        parts = data["candidates"][0]["content"]["parts"]
        return "".join(p.get("text", "") for p in parts)

    def available_models(self) -> list[str]:
        data = self._get(f"{self.base_url}/models", {"x-goog-api-key": self.api_key},
                         {"pageSize": 200})
        return sorted(
            m["name"].split("/")[-1]
            for m in data.get("models", [])
            if "generateContent" in (m.get("supportedGenerationMethods") or [])
            and is_chat_model(m["name"])
        )


ADAPTERS = {
    "openai": OpenAIAdapter,
    "anthropic": AnthropicAdapter,
    "gemini": GeminiAdapter,
    "deepseek": DeepSeekAdapter,
    "qwen": QwenAdapter,
}

# Fallback only: used when a provider is first added and whenever its models
# endpoint is unreachable. `available_models()` is the authoritative source —
# these ids WILL go stale (Google retired gemini-2.5-pro out from under us).
MODELS = {
    "openai": ["gpt-5", "gpt-5-mini", "gpt-4.1", "gpt-4o"],
    "anthropic": ["claude-opus-5", "claude-sonnet-5", "claude-haiku-4-5-20251001"],
    "gemini": ["gemini-3.5-flash", "gemini-3.1-flash-lite", "gemini-3.1-pro-preview",
               "gemini-pro-latest", "gemini-flash-latest"],
    "deepseek": ["deepseek-chat", "deepseek-reasoner"],
    "qwen": ["qwen-max", "qwen-plus", "qwen-turbo"],
}


def get_adapter(provider: str, api_key: str, base_url: str | None = None) -> ProviderAdapter:
    if provider not in ADAPTERS:
        raise ValueError(f"Unknown provider '{provider}'. Known: {', '.join(ADAPTERS)}")
    return ADAPTERS[provider](api_key, base_url)
