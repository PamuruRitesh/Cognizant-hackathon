from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import os
import requests

router = APIRouter(tags=["llm"])

class ChatRequest(BaseModel):
    message: str
    context: dict | None = None

@router.post("/chat")
def chat_with_grok(request: ChatRequest):
    grok_api_key = os.environ.get("GROK_API_KEY")
    # For demo/mock purposes, if no key is provided, we can return a mock response
    if not grok_api_key:
        if os.environ.get("DEMO_MODE", "false").lower() == "true":
            return {"response": f"Demo Mode: I am StockPilot AI. You said: {request.message}. I see you are looking at {len(request.context.get('grid', [])) if request.context else 0} risk items."}
        else:
            raise HTTPException(status_code=500, detail="GROK_API_KEY environment variable is not set")
            
    system_prompt = (
        "You are StockPilot AI, an expert supply chain assistant helping a planner manage inventory and stockout risks. "
        "Keep your answers concise, professional, and directly address the user's question using the provided context."
    )
    
    # Optional: include data context if provided by the frontend
    context_str = ""
    if request.context:
        # Simplify context to avoid token limits
        context_str = f"\n\nContext Data:\n{request.context}"
        
    try:
        resp = requests.post(
            "https://api.x.ai/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {grok_api_key}",
                "Content-Type": "application/json"
            },
            json={
                "model": "grok-2-latest",
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": f"{request.message}{context_str}"}
                ],
                "temperature": 0.2
            },
            timeout=30
        )
        resp.raise_for_status()
        return {"response": resp.json()["choices"][0]["message"]["content"]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
