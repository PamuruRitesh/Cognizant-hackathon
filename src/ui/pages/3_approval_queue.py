import streamlit as st

from app import api_get, api_post

st.header("Approval Queue")

recs = api_get("/recommendations", params={"status": "pending"}) or []

if not recs:
    st.info("No pending recommendations. Run `make mocks` or the daily planning job.")

for r in recs:
    with st.container(border=True):
        cols = st.columns([3, 1, 1, 1])
        cols[0].markdown(f"**{r['product_id']} @ {r['store_id']}** — {r['rationale']}")
        cols[1].metric("Recommended qty", r["recommended_qty"])
        cols[2].metric("Net benefit (₹)", f"{r['net_benefit']:,.0f}")
        if r.get("guardrail_flags"):
            cols[3].warning(", ".join(r["guardrail_flags"]))
        else:
            cols[3].success("clear")

        b1, b2, b3 = st.columns(3)
        if b1.button("Approve", key=f"appr_{r['rec_id']}"):
            api_post(f"/recommendations/{r['rec_id']}/approve", {"approver": "planner_demo"})
            st.rerun()
        if b2.button("Reject", key=f"rej_{r['rec_id']}"):
            api_post(f"/recommendations/{r['rec_id']}/reject", {"reason": "not needed", "approver": "planner_demo"})
            st.rerun()
        b3.button("Modify", key=f"mod_{r['rec_id']}", disabled=True, help="Stub — wire a qty input + approve with override")
