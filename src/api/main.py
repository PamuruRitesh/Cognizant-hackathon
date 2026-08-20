from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routes import (kpis, forecast, risk, recommendations, whatif, audit,
                     skus, simulation, aerospace, agents, llm, auth)

app = FastAPI(title="StockPilot API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(kpis.router, prefix="/api")
app.include_router(forecast.router, prefix="/api")
app.include_router(risk.router, prefix="/api")
app.include_router(recommendations.router, prefix="/api")
app.include_router(whatif.router, prefix="/api")
app.include_router(audit.router, prefix="/api")
app.include_router(skus.router, prefix="/api")
app.include_router(simulation.router, prefix="/api")
app.include_router(aerospace.router, prefix="/api")
app.include_router(agents.router, prefix="/api")
app.include_router(llm.router, prefix="/api")
app.include_router(auth.router, prefix="/api")


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/db-status")
def db_status():
    """Where the API is reading from right now: postgres or the local files."""
    from .data_access import source
    return source()
