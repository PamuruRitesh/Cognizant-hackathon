from fastapi import APIRouter
from pydantic import BaseModel

from ..data_access import load_forecasts

router = APIRouter(tags=["whatif"])


class WhatIfBody(BaseModel):
    store_id: str
    product_id: str
    discount: float | None = None
    price: float | None = None
    promo: bool | None = None
    lead_time: int | None = None


@router.post("/whatif")
def whatif(body: WhatIfBody):
    """Stub logic (per Day-3 plan: 'can be stubbed logic'). Swaps in
    src.forecast.lgbm_quantile.predict_with_overrides() once WS-1 ships real
    models — the function signature already matches CONTRACTS.md."""
    df = load_forecasts()
    base = df[(df.store_id == body.store_id) & (df.product_id == body.product_id)]
    if base.empty:
        return {"error": "no baseline forecast for that store/product"}
    row = base.iloc[0]

    multiplier = 1.0
    if body.discount:
        multiplier *= 1 + min(body.discount, 0.5) * 0.6  # monotone: discount up -> demand up
    if body.promo:
        multiplier *= 1.15

    return {
        "p10": round(float(row.p10) * multiplier, 2),
        "p50": round(float(row.p50) * multiplier, 2),
        "p90": round(float(row.p90) * multiplier, 2),
        "clamped": [],
        "note": "stub what-if logic — replace with predict_with_overrides()",
    }
