"""Run: python backend/ai/test_adapters.py

The adapters are thin, but the temperature fallback is real branching logic on a
money path — OpenAI's reasoning models reject `temperature: 0`, and without the
retry every prompt on gpt-5 fails.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from ai.adapters import (  # noqa: E402
    ADAPTERS,
    MODELS,
    OpenAIAdapter,
    ProviderError,
    get_adapter,
    is_chat_model,
)

TEMPERATURE_400 = (
    '{"error": {"message": "Unsupported value: \'temperature\' does not support 0 with this '
    'model. Only the default (1) value is supported.", "code": "unsupported_value"}}'
)


class FakeOpenAI(OpenAIAdapter):
    """Records every request body and fails the first call the way OpenAI does."""

    def __init__(self, fail_on_temperature=True, status=400, body=TEMPERATURE_400):
        super().__init__("key")
        self.bodies = []
        self.fail_on_temperature = fail_on_temperature
        self.status, self.body = status, body

    def _post(self, url, headers, body):
        self.bodies.append(dict(body))   # copy: the retry mutates the caller's dict
        if self.fail_on_temperature and "temperature" in body:
            raise ProviderError("FakeOpenAI", self.status, self.body)
        return {"choices": [{"message": {"content": "{}"}}]}


def main():
    # Reasoning model: first attempt carries temperature, retry drops it.
    a = FakeOpenAI()
    assert a.generate("sys", "user", "gpt-5") == "{}"
    assert len(a.bodies) == 2, a.bodies
    assert a.bodies[0]["temperature"] == 0
    assert "temperature" not in a.bodies[1]
    # The retry must keep everything else intact.
    assert a.bodies[1]["model"] == "gpt-5"
    assert a.bodies[1]["response_format"] == {"type": "json_object"}
    assert len(a.bodies[1]["messages"]) == 2

    # Ordinary model: one call, temperature kept.
    b = FakeOpenAI(fail_on_temperature=False)
    b.generate("sys", "user", "gpt-4o")
    assert len(b.bodies) == 1 and b.bodies[0]["temperature"] == 0

    # json_object mode requires the literal word "json" in the messages.
    f = FakeOpenAI(fail_on_temperature=False)
    f.generate("Reply with {\"ok\": true}.", "ping", "gpt-4o")
    assert "json" in f.bodies[0]["messages"][0]["content"].lower()
    g = FakeOpenAI(fail_on_temperature=False)
    g.generate("You output JSON only.", "brief", "gpt-4o")
    assert g.bodies[0]["messages"][0]["content"] == "You output JSON only.", "must not append twice"

    # reasoning_effort is sent when asked for, and dropped on a 400 that names it
    # (older models reject the param) without losing the rest of the request.
    h = FakeOpenAI(fail_on_temperature=False)
    h.generate("json", "u", "gpt-5", effort="low")
    assert h.bodies[0]["reasoning_effort"] == "low"

    class RejectsEffort(FakeOpenAI):
        def _post(self, url, headers, body):
            self.bodies.append(dict(body))
            if "reasoning_effort" in body:
                raise ProviderError("F", 400, '{"error": {"param": "reasoning_effort"}}')
            return {"choices": [{"message": {"content": "{}"}}]}

    i = RejectsEffort(fail_on_temperature=False)
    assert i.generate("json", "u", "gpt-4o", effort="low") == "{}"
    assert len(i.bodies) == 2 and "reasoning_effort" not in i.bodies[1]
    assert i.bodies[1]["temperature"] == 0, "must only drop the param the provider named"

    # json_mode off (the artifact write turn) omits response_format.
    c = FakeOpenAI(fail_on_temperature=False)
    c.generate("sys", "user", "gpt-4o", json_mode=False)
    assert "response_format" not in c.bodies[0]

    # Any other 400 still raises — the fallback must not swallow real errors.
    d = FakeOpenAI(status=400, body='{"error": {"message": "model not found"}}')
    try:
        d.generate("sys", "user", "gpt-4o")
        raise AssertionError("a non-temperature 400 should propagate")
    except ProviderError as exc:
        assert "model not found" in exc.body
    assert len(d.bodies) == 1, "must not retry an unrelated failure"

    # A 429 must not be retried either.
    e = FakeOpenAI(status=429, body="temperature mentioned but rate limited")
    try:
        e.generate("sys", "user", "gpt-4o")
        raise AssertionError("429 should propagate")
    except ProviderError:
        pass
    assert len(e.bodies) == 1

    # Every provider is constructible and curated ids are chat-usable.
    for name in ADAPTERS:
        get_adapter(name, "key")
        assert MODELS[name] and all(is_chat_model(m) for m in MODELS[name]), name

    print("adapters: all checks passed")


if __name__ == "__main__":
    main()
