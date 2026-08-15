import os

import requests
import streamlit as st

API_BASE = os.environ.get("STOCKPILOT_API_BASE", "http://localhost:8000/api")

st.set_page_config(page_title="StockPilot — Control Tower", layout="wide")

PAGES = {
    "Command Center": "pages/1_command_center.py",
    "SKU Detail": "pages/2_sku_detail.py",
    "Approval Queue": "pages/3_approval_queue.py",
    "What-If Simulator": "pages/4_whatif.py",
    "Audit & Agent Trace": "pages/5_audit.py",
}

st.sidebar.title("StockPilot")
st.sidebar.caption("Autonomous Demand & Replenishment Control Tower")
st.sidebar.markdown("---")
st.sidebar.info(
    "Use the pages in the left nav (Streamlit multipage). This file is the "
    "shared entry point / theme config."
)


def api_get(path: str, params: dict | None = None):
    try:
        r = requests.get(f"{API_BASE}{path}", params=params, timeout=5)
        r.raise_for_status()
        return r.json()
    except Exception as e:
        st.error(f"API error calling {path}: {e}")
        return None


def api_post(path: str, json_body: dict):
    try:
        r = requests.post(f"{API_BASE}{path}", json=json_body, timeout=5)
        r.raise_for_status()
        return r.json()
    except Exception as e:
        st.error(f"API error calling {path}: {e}")
        return None


st.title("StockPilot Control Tower")
st.write(
    "Forecasts demand with confidence bounds, spots stockouts before they happen, "
    "and drafts purchase orders for a human planner to approve in one click."
)
st.markdown("Pick a screen from the left sidebar to get started (Command Center is the daily landing page).")
