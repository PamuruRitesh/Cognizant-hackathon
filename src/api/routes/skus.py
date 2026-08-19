from fastapi import APIRouter
from ..data_access import load_forecasts

router = APIRouter(tags=["skus"])

@router.get("/skus")
def get_skus():
    df = load_forecasts()
    # Get unique store_id and product_id pairs
    unique_skus = df[['store_id', 'product_id']].drop_duplicates().to_dict(orient='records')
    return {"skus": unique_skus}
