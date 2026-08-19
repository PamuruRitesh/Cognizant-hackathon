"""
LangGraph state machine wiring for Aerospace.
Isolated from Olist.
"""
from __future__ import annotations

import os
import sqlite3
import uuid

try:
    from langgraph.graph import StateGraph, START, END
    from langgraph.checkpoint.sqlite import SqliteSaver
except ImportError:
    StateGraph = None

from .aerospace_nodes import (
    data_quality_node,
    forecast_node,
    risk_node,
    replenishment_planner_node,
    guardrail_check_node,
    human_approval_interrupt,
    executor_node,
)
from .state import PlanningState

CHECKPOINT_DB = os.path.join(os.path.dirname(__file__), "..", "..", "data", "aerospace_checkpoints.sqlite")


def build_aerospace_graph():
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
    conn = sqlite3.connect(CHECKPOINT_DB, check_same_thread=False)
    checkpointer = SqliteSaver(conn)
    return graph.compile(checkpointer=checkpointer, interrupt_before=["human_approval"])


def run_aerospace_daily_plan(plan_date: str) -> dict:
    """Kicks off a fresh planning run and returns immediately after the
    interrupt (i.e. once recommendations are pending approval)."""
    app = build_aerospace_graph()
    thread_id = str(uuid.uuid4())
    config = {"configurable": {"thread_id": thread_id}}
    initial_state: PlanningState = {"run_id": thread_id, "thread_id": thread_id, "plan_date": plan_date}
    result = app.invoke(initial_state, config=config)
    result["thread_id"] = thread_id
    return result


def resume_aerospace_after_approval(thread_id: str, approved: list, rejected: list) -> dict:
    app = build_aerospace_graph()
    config = {"configurable": {"thread_id": thread_id}}
    app.update_state(config, {"approved": approved, "rejected": rejected})
    return app.invoke(None, config=config)


if __name__ == "__main__":
    if StateGraph is None:
        print("langgraph not installed")
    else:
        out = run_aerospace_daily_plan(plan_date="2024-11-25")
        print("Aerospace Graph paused at human_approval. Pending:", len(out.get("pending_approval", [])))
