"""
LLM provider abstraction + disk cache + offline fallback.

The one rule that makes this defensible: the LLM never computes a number.
It only explains numbers that deterministic code already produced. Every
narrative is generated from a structured `evidence` dict and cached to disk
so DEMO_MODE=true can run with zero network calls.
"""
from __future__ import annotations

import hashlib
import json
import os

CACHE_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "cache", "narratives.json")
DEMO_MODE = os.environ.get("DEMO_MODE", "false").lower() == "true"


def _cache_key(evidence: dict) -> str:
    return hashlib.sha256(json.dumps(evidence, sort_keys=True).encode()).hexdigest()[:16]


def _load_cache() -> dict:
    if os.path.exists(CACHE_PATH):
        with open(CACHE_PATH) as f:
            return json.load(f)
    return {}


def _save_cache(cache: dict) -> None:
    os.makedirs(os.path.dirname(CACHE_PATH), exist_ok=True)
    with open(CACHE_PATH, "w") as f:
        json.dump(cache, f, indent=2)


def _template_narrative(evidence: dict) -> str:
    """Deterministic offline fallback — no network, no hallucinated numbers.
    Every number here is read straight from evidence, never computed."""
    product = evidence.get("product_id", "this SKU")
    store = evidence.get("store_id", "this store")
    qty = evidence.get("recommended_qty", "?")
    days = evidence.get("days_to_stockout", "?")
    driver = (evidence.get("top_drivers") or ["demand trend"])[0]
    return (
        f"Order {qty} units of {product} at {store} — demand risk is driven by "
        f"{driver.replace('_', ' ')}, and you'll stock out in {days} days at the "
        f"current run rate."
    )


def explain(evidence: dict, provider_call=None) -> str:
    """provider_call: optional callable(evidence) -> str, e.g. a Groq/Gemini
    wrapper. If DEMO_MODE or provider_call is None, use cache/template only."""
    cache = _load_cache()
    key = _cache_key(evidence)
    if key in cache:
        return cache[key]

    if DEMO_MODE or provider_call is None:
        narrative = _template_narrative(evidence)
    else:
        try:
            narrative = provider_call(evidence)
        except Exception:
            narrative = _template_narrative(evidence)

    cache[key] = narrative
    _save_cache(cache)
    return narrative

def call_grok_api(evidence: dict) -> str:
    import requests
    api_key = os.environ.get("XAI_API_KEY")
    if not api_key:
        raise ValueError("No XAI_API_KEY found in environment")
    
    prompt = f"Explain this stockout risk recommendation briefly in 2 sentences. Keep it professional and crisp. Data: {evidence}"
    
    resp = requests.post(
        "https://api.x.ai/v1/chat/completions",
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        json={
            "model": "grok-beta",
            "messages": [{"role": "system", "content": "You are an expert supply chain analyst AI."},
                         {"role": "user", "content": prompt}],
            "temperature": 0.3
        },
        timeout=10
    )
    resp.raise_for_status()
    return resp.json()["choices"][0]["message"]["content"]
