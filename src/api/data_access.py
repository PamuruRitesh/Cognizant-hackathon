"""
Single place that decides whether routes read mocks/ or data/processed/.
Swap STOCKPILOT_DATA_DIR to flip every route from mock to real data — this is
the "change one config path" moment described in CONTRACTS.md §4.
"""
from __future__ import annotations

import json
import os

import pandas as pd

_ROOT = os.path.join(os.path.dirname(__file__), "..", "..")
_PROCESSED = os.path.join(_ROOT, "data", "processed")
_DEFAULT = _PROCESSED if os.path.exists(os.path.join(_PROCESSED, "forecasts.parquet")) else os.path.join(_ROOT, "mocks")
DATA_DIR = os.environ.get("STOCKPILOT_DATA_DIR", _DEFAULT)


def load_forecasts() -> pd.DataFrame:
    return pd.read_parquet(os.path.join(DATA_DIR, "forecasts.parquet"))


def load_forecasts_lt() -> pd.DataFrame:
    return pd.read_parquet(os.path.join(DATA_DIR, "forecasts_lt.parquet"))


def load_recommendations() -> list[dict]:
    with open(os.path.join(DATA_DIR, "recommendations.json")) as f:
        return json.load(f)


def save_recommendations(recs: list[dict]) -> None:
    with open(os.path.join(DATA_DIR, "recommendations.json"), "w") as f:
        json.dump(recs, f, indent=2)

def load_simulation_results() -> dict:
    path = os.path.join(DATA_DIR, "simulation_results.json")
    if not os.path.exists(path):
        return {}
    with open(path) as f:
        return json.load(f)


AUDIT_LOG_PATH = os.path.join(DATA_DIR, "audit_log.json")


def load_audit_log() -> list[dict]:
    if not os.path.exists(AUDIT_LOG_PATH):
        return []
    with open(AUDIT_LOG_PATH) as f:
        return json.load(f)


def append_audit_entry(entry: dict) -> None:
    log = load_audit_log()
    log.append(entry)
    with open(AUDIT_LOG_PATH, "w") as f:
        json.dump(log, f, indent=2)
