"""
Langfuse tracing for every Grok call — optional and fully defensive.

If LANGFUSE_PUBLIC_KEY and LANGFUSE_SECRET_KEY are set (and the langfuse package
is installed), each agent call is logged to Langfuse as a generation with its
prompt, response, token usage, latency, and the agent name. If the keys are
missing or anything fails, this is a no-op and the app runs exactly as before.

Env vars:
  LANGFUSE_PUBLIC_KEY   pk-lf-...
  LANGFUSE_SECRET_KEY   sk-lf-...
  LANGFUSE_HOST         default https://cloud.langfuse.com
                        (use https://us.cloud.langfuse.com for the US region)
"""
from __future__ import annotations

import contextlib
import os

_client = None
_state = None  # None = not tried, True = enabled, False = disabled


def _init():
    global _client, _state
    if _state is not None:
        return
    pk = os.environ.get("LANGFUSE_PUBLIC_KEY")
    sk = os.environ.get("LANGFUSE_SECRET_KEY")
    if not (pk and sk):
        _state = False
        return
    try:
        from langfuse import Langfuse

        _client = Langfuse(
            public_key=pk,
            secret_key=sk,
            host=os.environ.get("LANGFUSE_HOST", "https://cloud.langfuse.com"),
        )
        _state = True
    except Exception:
        _client, _state = None, False


def enabled() -> bool:
    _init()
    return bool(_state)


class _Noop:
    def update(self, **_):
        pass


@contextlib.contextmanager
def observe_generation(name: str, model: str, prompt_messages, metadata: dict | None = None):
    """Context manager yielding a generation handle with .update(output=..., usage_details=...).
    No-ops cleanly when Langfuse is disabled or errors."""
    _init()
    if not _state:
        yield _Noop()
        return
    try:
        cm = _client.start_as_current_observation(
            as_type="generation",
            name=name,
            model=model,
            input=prompt_messages,
            metadata=metadata or {},
        )
    except Exception:
        # Couldn't even start the span -> trace nothing, don't disturb the call.
        yield _Noop()
        return
    # Yield exactly once. If the body raises, let it propagate so Langfuse's own
    # __exit__ records the error; never yield a second time.
    with cm as gen:
        yield gen


def flush():
    """Ensure buffered traces are sent (important for short-lived scripts)."""
    _init()
    if _state and _client is not None:
        try:
            _client.flush()
        except Exception:
            pass
