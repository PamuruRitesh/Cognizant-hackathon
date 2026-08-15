from fastapi import APIRouter

from ..data_access import load_audit_log

router = APIRouter(tags=["audit"])


@router.get("/audit")
def get_audit():
    return load_audit_log()


@router.get("/agent-trace/{run_id}")
def get_agent_trace(run_id: str):
    """Stub — wire to the LangGraph SqliteSaver checkpointer to replay the
    step-by-step state history for a given thread_id/run_id."""
    return {"run_id": run_id, "steps": [], "note": "wire to LangGraph checkpointer"}
