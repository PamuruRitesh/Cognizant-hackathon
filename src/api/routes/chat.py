from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(tags=["chat"])

ALLOWED_TABLES = {"inventory_daily", "forecasts", "recommendations"}


class ChatBody(BaseModel):
    question: str


@router.post("/chat")
def chat(body: ChatBody):
    """Analyst Agent stub: natural language -> SQL over DuckDB with a
    table/column allow-list (ALLOWED_TABLES). Wire to a real LLM call in
    src/agents/llm.py; keep the allow-list check even once wired for real —
    it's the guardrail that keeps this endpoint safe to demo."""
    return {
        "answer": "Analyst Agent stub — wire to DuckDB + llm.py. Allowed tables: "
        + ", ".join(sorted(ALLOWED_TABLES)),
        "sql": None,
        "table": None,
    }
