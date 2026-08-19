"""
Single Grok (xAI) client for the whole project.

Every agent goes through here, so there is exactly one place that knows the
API key, the model, the endpoint, and the cache. The xAI API is OpenAI-compatible
(https://api.x.ai/v1/chat/completions).

Env vars:
  XAI_API_KEY   the key (paste it into .env)
  XAI_MODEL     model id, default "grok-3". Set to grok-4 / grok-4.6 etc. if your
                key has access. `latest` is the always-valid alias per xAI docs.
  XAI_BASE_URL  default https://api.x.ai/v1
  DEMO_MODE     "true" forces offline: never calls the network, callers fall back.

Design rule kept from the start: the model never computes a number. It only
reasons over figures that deterministic code already produced and passes in.
"""
from __future__ import annotations

import hashlib
import json
import os

import requests
from dotenv import load_dotenv

load_dotenv()

from .observability import observe_generation, flush

BASE_URL = os.environ.get("XAI_BASE_URL", "https://api.x.ai/v1").rstrip("/")
MODEL = os.environ.get("XAI_MODEL", "grok-4-fast")
TIMEOUT = float(os.environ.get("XAI_TIMEOUT", "30"))

_CACHE_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "cache", "grok.json")


def _api_key() -> str | None:
    # Accept either name so we don't fight the two that were already in the repo.
    return os.environ.get("XAI_API_KEY") or os.environ.get("GROK_API_KEY")


def demo_mode() -> bool:
    return os.environ.get("DEMO_MODE", "false").lower() == "true"


def status() -> dict:
    """Used by the UI to show an honest 'AI available / unavailable' badge."""
    key = _api_key()
    if demo_mode():
        return {"available": False, "reason": "DEMO_MODE is on (offline)", "model": MODEL}
    if not key:
        return {"available": False, "reason": "XAI_API_KEY not set", "model": MODEL}
    return {"available": True, "reason": "ok", "model": MODEL}


def _load_cache() -> dict:
    if os.path.exists(_CACHE_PATH):
        try:
            with open(_CACHE_PATH) as f:
                return json.load(f)
        except Exception:
            return {}
    return {}


def _save_cache(cache: dict) -> None:
    os.makedirs(os.path.dirname(_CACHE_PATH), exist_ok=True)
    with open(_CACHE_PATH, "w") as f:
        json.dump(cache, f, indent=2)


def _key(system: str, user: str, temperature: float) -> str:
    blob = json.dumps([MODEL, system, user, temperature], sort_keys=True)
    return hashlib.sha256(blob.encode()).hexdigest()[:20]


class GrokUnavailable(RuntimeError):
    """Raised when there is no key / DEMO_MODE / the call failed. Callers decide
    whether to fall back to a template or surface the unavailable state."""


def chat(system: str, user: str, temperature: float = 0.2, max_tokens: int = 400,
         use_cache: bool = True, name: str = "grok", metadata: dict | None = None) -> str:
    """One Grok chat turn. Returns the assistant text.

    Raises GrokUnavailable if the model cannot be reached (no key, DEMO_MODE, or
    a network/API error). Successful responses are cached to disk so a repeated
    call during a demo is instant and free.
    """
    ckey = _key(system, user, temperature)
    cache = _load_cache() if use_cache else {}
    if use_cache and ckey in cache:
        return cache[ckey]

    key = _api_key()
    if demo_mode() or not key:
        raise GrokUnavailable(status()["reason"])

    messages = [
        {"role": "system", "content": system},
        {"role": "user", "content": user},
    ]
    with observe_generation(name=name, model=MODEL, prompt_messages=messages,
                            metadata={"temperature": temperature, **(metadata or {})}) as gen:
        try:
            resp = requests.post(
                f"{BASE_URL}/chat/completions",
                headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                json={"model": MODEL, "messages": messages,
                      "temperature": temperature, "max_tokens": max_tokens},
                timeout=TIMEOUT,
            )
            if resp.status_code >= 400:
                # Surface xAI's real reason (e.g. "model grok-3 does not exist"),
                # not just the HTTP status — otherwise a wrong model looks like a
                # generic failure.
                try:
                    body = resp.json()
                    detail = body.get("error") or body.get("message") or resp.text
                    if isinstance(detail, dict):
                        detail = detail.get("message") or str(detail)
                except Exception:
                    detail = resp.text[:300]
                raise GrokUnavailable(f"HTTP {resp.status_code} from xAI (model '{MODEL}'): {detail}")
            data = resp.json()
            text = data["choices"][0]["message"]["content"].strip()
            usage = data.get("usage") or {}
            gen.update(output=text, usage_details={
                "input": usage.get("prompt_tokens"),
                "output": usage.get("completion_tokens"),
                "total": usage.get("total_tokens"),
            })
        except Exception as e:  # network, auth, rate-limit, bad model id, etc.
            gen.update(level="ERROR", status_message=str(e))
            flush()
            raise GrokUnavailable(str(e)) from e
    flush()

    if use_cache:
        cache[ckey] = text
        _save_cache(cache)
    return text


def chat_json(system: str, user: str, temperature: float = 0.2, max_tokens: int = 500,
              name: str = "grok", metadata: dict | None = None) -> dict:
    """Grok call that must return a JSON object. Robust to models that wrap the
    JSON in prose or ```json fences. Raises GrokUnavailable on transport failure;
    raises ValueError if a reply came back but wasn't parseable JSON."""
    raw = chat(system, user + "\n\nReply with ONLY a JSON object, no prose.",
               temperature=temperature, max_tokens=max_tokens, name=name, metadata=metadata)
    return _extract_json(raw)


def _extract_json(text: str) -> dict:
    t = text.strip()
    if t.startswith("```"):
        t = t.split("```", 2)[1]
        if t.lstrip().lower().startswith("json"):
            t = t.lstrip()[4:]
    start, end = t.find("{"), t.rfind("}")
    if start != -1 and end != -1 and end > start:
        t = t[start : end + 1]
    return json.loads(t)


_ping = {"t": 0.0, "result": None}


def ping() -> dict:
    """Real liveness check: actually calls the model once (1 token), cached 60s.
    Used by /api/agent-status so the header pill reflects a working model, not
    just a present key."""
    import time
    now = time.time()
    if _ping["result"] and (now - _ping["t"] < 60):
        return _ping["result"]
    st = status()
    if not st["available"]:
        _ping.update(t=now, result=st)
        return st
    try:
        chat("You are a health check.", "Reply with OK.", max_tokens=1,
             use_cache=False, name="healthcheck")
        res = {"available": True, "reason": "ok", "model": MODEL}
    except GrokUnavailable as e:
        res = {"available": False, "reason": str(e)[:200], "model": MODEL}
    _ping.update(t=now, result=res)
    return res
