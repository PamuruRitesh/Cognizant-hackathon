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
def get_recommendations(status: str = Query(default="pending")):
    recs = load_recommendations()
    return [r for r in recs if status == "all" or r["status"] == status]


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
