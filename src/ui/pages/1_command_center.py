import pandas as pd
import streamlit as st

from app import api_get

st.header("Command Center")

kpis = api_get("/kpis") or {}
c1, c2, c3, c4 = st.columns(4)
c1.metric("Stockout-risk SKUs", kpis.get("stockout_risk_skus", "—"))
c2.metric("₹ at risk", f"{kpis.get('value_at_risk', 0):,.0f}")
c3.metric("Forecast lift vs incumbent", f"{kpis.get('avg_forecast_accuracy_lift_pct', 0)}%")
c4.metric("Pending approvals", kpis.get("pending_approvals", "—"))

st.subheader("Risk heatmap — store x SKU")
risk = api_get("/risk") or {}
grid = risk.get("grid", [])
if grid:
    df = pd.DataFrame(grid)
    pivot = df.pivot_table(index="store_id", columns="product_id", values="risk_score", aggfunc="mean")
    st.dataframe(pivot.style.background_gradient(cmap="Reds", axis=None), use_container_width=True)
else:
    st.info("No risk data yet — run `make mocks` or wait for the daily planning run.")
