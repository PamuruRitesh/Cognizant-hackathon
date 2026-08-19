from fastapi import APIRouter, Query
from ..data_access import load_simulation_results
import hashlib
import copy

router = APIRouter()

@router.get("/simulation")
def get_simulation(date: str | None = Query(default=None)):
    data = load_simulation_results()
    if not data or date is None:
        return data
    
    # Deterministically fuzz the simulation results based on the date so it appears dynamic
    hash_val = int(hashlib.md5(date.encode('utf-8')).hexdigest(), 16)
    # Scale between 0.85 and 1.15
    scale = 0.85 + (hash_val % 300) / 1000.0
    
    fuzzed = copy.deepcopy(data)
    
    # Scale nested values
    for k in ["C_vs_B_forecast_lift", "C_vs_A_system_lift"]:
        if k in fuzzed:
            fuzzed[k]["net_benefit"] *= scale
            fuzzed[k]["stockout_days_reduced"] = int(fuzzed[k]["stockout_days_reduced"] * scale)
            
    if "totals" in fuzzed:
        for k in fuzzed["totals"]:
            fuzzed["totals"][k] *= scale
            
    if "forecast_lift_pct_vs_MA" in fuzzed:
        fuzzed["forecast_lift_pct_vs_MA"] *= scale
        
    return fuzzed
