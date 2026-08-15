import pandas as pd
import streamlit as st

from app import api_get

st.header("Audit & Agent Trace")

log = api_get("/audit") or []
if log:
    st.dataframe(pd.DataFrame(log), use_container_width=True)
else:
    st.info("No audit entries yet — approve or reject a recommendation in the Approval Queue.")

st.subheader("Agent trace viewer")
run_id = st.text_input("Run ID (thread_id)")
if run_id:
    trace = api_get(f"/agent-trace/{run_id}")
    st.json(trace)
