from fastapi import APIRouter, HTTPException, Query

from ..data_access import load_forecasts

router = APIRouter(tags=["forecast"])


@router.get("/forecast")
def get_forecast(store_id: str, product_id: str, horizon: int = Query(default=14, le=14, ge=1)):
    df = load_forecasts()
    subset = df[(df.store_id == store_id) & (df.product_id == product_id) & (df.horizon <= horizon)]
    if subset.empty:
        raise HTTPException(404, "no forecast for that store/product")
    return subset.sort_values("horizon").to_dict(orient="records")
