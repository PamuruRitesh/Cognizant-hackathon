import pandas as pd
import plotly.graph_objects as go
import streamlit as st

from app import api_get

st.header("SKU Detail")

col1, col2 = st.columns(2)
store_id = col1.text_input("Store ID", value="S1")
product_id = col2.text_input("Product ID", value="P0001")

if st.button("Load forecast"):
    data = api_get("/forecast", params={"store_id": store_id, "product_id": product_id})
    if data:
        df = pd.DataFrame(data)
        fig = go.Figure()
        fig.add_trace(go.Scatter(x=df.horizon, y=df.p90, line=dict(width=0), showlegend=False))
        fig.add_trace(
            go.Scatter(
                x=df.horizon, y=df.p10, fill="tonexty", fillcolor="rgba(99,110,250,0.2)",
                line=dict(width=0), name="P10–P90 band",
            )
        )
        fig.add_trace(go.Scatter(x=df.horizon, y=df.p50, line=dict(color="royalblue"), name="P50 forecast"))
        fig.add_trace(go.Scatter(x=df.horizon, y=df.actual, line=dict(color="black", dash="dot"), name="Actual"))
        fig.add_trace(go.Scatter(x=df.horizon, y=df.incumbent, line=dict(color="orange", dash="dash"), name="Incumbent (oracle ceiling)"))
        fig.update_layout(title=f"{product_id} @ {store_id} — forecast fan chart", xaxis_title="Horizon (days)", yaxis_title="Units")
        st.plotly_chart(fig, use_container_width=True)

        st.subheader("SHAP driver bars")
        st.info("Wire to shap_drivers.parquet once WS-1 ships SHAP attribution (Day 4).")
