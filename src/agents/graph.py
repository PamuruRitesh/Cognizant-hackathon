"""
LangGraph state machine wiring.

Architecture decision (Day 1): the graph does NOT stream through the UI.
Streamlit re-runs its whole script on every widget interaction, which makes a
paused-mid-execution graph resumed from a button genuinely fiddly. Instead:

  1. The daily planning run executes as a BATCH JOB (e.g. `make plan` / a
     scheduled task), hits interrupt() at the approval gate, persists pending
     recommendations + its thread_id to the SQLite checkpointer, and exits.
  2. Streamlit only reads and writes rows (via the API).
  3. POST /api/recommendations/{rec_id}/approve resumes the graph by
     thread_id in a FastAPI background task.

Same demo, same "durable, resumable, auditable state machine" answer in Q&A,
a fraction of the integration risk.
"""
from __future__ import annotations

import os
import sqlite3
import uuid

try:
    from langgraph.graph import StateGraph, START, END
    from langgraph.checkpoint.sqlite import SqliteSaver
except ImportError:  # pragma: no cover - optional at scaffold time
    StateGraph = None

from .nodes import (
    data_quality_node,
    forecast_node,
    risk_node,
    replenishment_planner_node,
    guardrail_check_node,
    human_approval_interrupt,
    executor_node,
)
from .state import PlanningState

CHECKPOINT_DB = os.path.join(os.path.dirname(__file__), "..", "..", "data", "checkpoints.sqlite")


def build_graph():
    if StateGraph is None:
        raise ImportError("pip install langgraph --break-system-packages")

    graph = StateGraph(PlanningState)
    graph.add_node("data_quality", data_quality_node)
    graph.add_node("forecast", forecast_node)
    graph.add_node("risk", risk_node)
    graph.add_node("planner", replenishment_planner_node)
    graph.add_node("guardrail_check", guardrail_check_node)
    graph.add_node("human_approval", human_approval_interrupt)
    graph.add_node("executor", executor_node)

    graph.add_edge(START, "data_quality")
    graph.add_edge("data_quality", "forecast")
    graph.add_edge("forecast", "risk")
    graph.add_edge("risk", "planner")
    graph.add_edge("planner", "guardrail_check")
    graph.add_edge("guardrail_check", "human_approval")
    graph.add_edge("human_approval", "executor")
    graph.add_edge("executor", END)

    os.makedirs(os.path.dirname(CHECKPOINT_DB), exist_ok=True)
    # from_conn_string() is a context manager in checkpoint-sqlite 1.x;
    # passing it directly to compile() hands over a generator, not a saver.
    conn = sqlite3.connect(CHECKPOINT_DB, check_same_thread=False)
    checkpointer = SqliteSaver(conn)
    return graph.compile(checkpointer=checkpointer, interrupt_before=["human_approval"])


def run_daily_plan(plan_date: str) -> dict:
    """Kicks off a fresh planning run and returns immediately after the
    interrupt (i.e. once recommendations are pending approval)."""
    app = build_graph()
    thread_id = str(uuid.uuid4())
    config = {"configurable": {"thread_id": thread_id}}
    initial_state: PlanningState = {"run_id": thread_id, "thread_id": thread_id, "plan_date": plan_date}
    result = app.invoke(initial_state, config=config)
    result["thread_id"] = thread_id
    return result


def resume_after_approval(thread_id: str, approved: list, rejected: list) -> dict:
    app = build_graph()
    config = {"configurable": {"thread_id": thread_id}}
    app.update_state(config, {"approved": approved, "rejected": rejected})
    return app.invoke(None, config=config)


# Toy-state smoke test for Day 1 hour 3: prove interrupt/resume works before
# wiring any real nodes. Run: python -m src.agents.graph
if __name__ == "__main__":
    if StateGraph is None:
        print("langgraph not installed — run `pip install langgraph --break-system-packages`")
    else:
        out = run_daily_plan(plan_date="2023-10-04")
        print("Paused at human_approval. Pending:", len(out.get("pending_approval", [])))
