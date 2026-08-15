import streamlit as st

from app import api_get, api_post

st.header("What-If Simulator")

c1, c2 = st.columns(2)
store_id = c1.text_input("Store ID", value="S1", key="wi_store")
product_id = c2.text_input("Product ID", value="P0001", key="wi_product")

discount = st.slider("Discount %", 0, 50, 0) / 100.0
promo = st.checkbox("Holiday / promotion flag")
lead_time = st.slider("Lead time (days)", 1, 14, 3)

if st.button("Re-forecast"):
    result = api_post(
        "/whatif",
        {"store_id": store_id, "product_id": product_id, "discount": discount, "promo": promo, "lead_time": lead_time},
    )
    if result and "error" not in result:
        c1, c2, c3 = st.columns(3)
        c1.metric("P10", result["p10"])
        c2.metric("P50", result["p50"])
        c3.metric("P90", result["p90"])
        st.caption(result.get("note", ""))
        st.info("Next: feed this back into src.inventory.safety_stock for the cost delta (Day 4).")
    elif result:
        st.error(result["error"])
