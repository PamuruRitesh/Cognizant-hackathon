from fastapi import APIRouter, Query

from ..data_access import load_recommendations

router = APIRouter(tags=["risk"])


@router.get("/risk")
def get_risk(
    date: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=10, ge=1, le=100)
):
    recs = load_recommendations()
    grid = [
        {
            "store_id": r["store_id"],
            "product_id": r["product_id"],
            "risk_score": r["stockout_risk_7d"],
            "days_to_stockout": r["days_to_stockout"],
        }
        for r in recs
        if date is None or r["date"] == date
    ]
    start = (page - 1) * limit
    return {
        "date": date,
        "total": len(grid),
        "page": page,
        "limit": limit,
        "grid": grid[start:start+limit]
    }
