import json
import os

import joblib
import pandas as pd
from fastapi import APIRouter
from pydantic import BaseModel

from ..data_access import DATA_DIR, load_forecasts
from ...forecast.lgbm_quantile import predict_with_overrides

router = APIRouter(tags=["whatif"])

MODELS_DIR = os.path.join(DATA_DIR, "models")
_models = None
_ranges = None


def _load_models():
    global _models, _ranges
    if _models is None and os.path.exists(os.path.join(MODELS_DIR, "lgbm_p50.joblib")):
        _models = {q: joblib.load(os.path.join(MODELS_DIR, f"lgbm_{q}.joblib")) for q in ("p10", "p50", "p90")}
        with open(os.path.join(MODELS_DIR, "training_ranges.json")) as f:
            _ranges = json.load(f)
    return _models, _ranges


class WhatIfBody(BaseModel):
    store_id: str
    product_id: str
    discount: float | None = None
    price: float | None = None
    promo: bool | None = None
    lead_time: int | None = None


@router.post("/whatif")
def whatif(body: WhatIfBody):
    models, ranges = _load_models()
    df = load_forecasts()
    base = df[(df.store_id == body.store_id) & (df.product_id == body.product_id)]
    if base.empty:
        return {"error": "no baseline forecast for that store/product"}
    row = base.iloc[0]

    if models is not None:
        feats_path = os.path.join(DATA_DIR, "features.parquet")
        feats = pd.read_parquet(feats_path)
        frow = feats[feats.seller_id == body.product_id].sort_values("day").tail(1)
        if not frow.empty:
            overrides = {}
            if body.price is not None:
                overrides["avg_price"] = body.price
            if body.lead_time is not None:
                overrides["lt_mean"] = float(body.lead_time)
            tr = {k: tuple(v) for k, v in ranges["ranges"].items()}
            out = predict_with_overrides(models, frow, ranges["feature_cols"], overrides, tr)
            
            multiplier = 1.0
            if body.discount:
                multiplier *= 1 + min(body.discount, 0.5) * 0.6
            if body.promo:
                multiplier *= 1.15
                
            out["p10"] = round(out["p10"] * multiplier, 2)
            out["p50"] = round(out["p50"] * multiplier, 2)
            out["p90"] = round(out["p90"] * multiplier, 2)
            
            out["note"] = "live model prediction with clamped overrides"
            return out

    multiplier = 1.0
    if body.discount:
        multiplier *= 1 + min(body.discount, 0.5) * 0.6
    if body.promo:
        multiplier *= 1.15
    return {
        "p10": round(float(row.p10) * multiplier, 2),
        "p50": round(float(row.p50) * multiplier, 2),
        "p90": round(float(row.p90) * multiplier, 2),
        "clamped": [],
        "note": "fallback multiplier (models not found on disk)",
    }
