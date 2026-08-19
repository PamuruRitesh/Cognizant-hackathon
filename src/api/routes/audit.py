from fastapi import APIRouter, Query

from ..data_access import load_audit_log

router = APIRouter(tags=["audit"])


@router.get("/audit")
def get_audit(
    action: str = Query(default="all"),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=10, ge=1, le=100)
):
    logs = load_audit_log()
    # Reverse logs to show newest first if desired, or keep as is. Usually audit logs are newest first.
    # Let's keep original order for now to avoid breaking existing UI assumptions, but filter it:
    filtered = [lg for lg in logs if action == "all" or lg.get("action") == action]
    start = (page - 1) * limit
    return {
        "total": len(filtered),
        "page": page,
        "limit": limit,
        "items": filtered[start:start+limit]
    }


@router.get("/agent-trace/{run_id}")
def get_agent_trace(run_id: str):
    """Stub — wire to the LangGraph SqliteSaver checkpointer to replay the
    step-by-step state history for a given thread_id/run_id."""
    return {"run_id": run_id, "steps": [], "note": "wire to LangGraph checkpointer"}
