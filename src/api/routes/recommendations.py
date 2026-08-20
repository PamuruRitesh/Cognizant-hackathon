from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from ..data_access import (
    append_audit_entry,
    load_recommendations,
    save_recommendations,
)

router = APIRouter(tags=["recommendations"])


class ApproveBody(BaseModel):
    qty: float | None = None
    approver: str
    note: str | None = None


class RejectBody(BaseModel):
    reason: str
    approver: str


@router.get("/recommendations")
def get_recommendations(
    status: str = Query(default="pending"),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=10, ge=1, le=5000)
):
    recs = load_recommendations()
    filtered = [r for r in recs if status == "all" or r["status"] == status]
    start = (page - 1) * limit
    return {
        "total": len(filtered),
        "page": page,
        "limit": limit,
        "items": filtered[start:start+limit]
    }


@router.post("/recommendations/{rec_id}/approve")
def approve(rec_id: str, body: ApproveBody):
    recs = load_recommendations()
    for r in recs:
        if r["rec_id"] == rec_id:
            r["status"] = "approved"
            r["recommended_qty"] = body.qty if body.qty is not None else r["recommended_qty"]
            save_recommendations(recs)
            append_audit_entry(
                {
                    "rec_id": rec_id,
                    "action": "approved",
                    "approver": body.approver,
                    "note": body.note,
                    "qty": r["recommended_qty"],
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                }
            )
            return r
    raise HTTPException(404, "rec_id not found")


@router.post("/recommendations/{rec_id}/reject")
def reject(rec_id: str, body: RejectBody):
    recs = load_recommendations()
    for r in recs:
        if r["rec_id"] == rec_id:
            r["status"] = "rejected"
            save_recommendations(recs)
            append_audit_entry(
                {
                    "rec_id": rec_id,
                    "action": "rejected",
                    "approver": body.approver,
                    "reason": body.reason,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                }
            )
            return r
    raise HTTPException(404, "rec_id not found")
