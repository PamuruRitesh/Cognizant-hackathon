from fastapi import APIRouter
from ..data_access import load_simulation_results

router = APIRouter()

@router.get("/simulation")
def get_simulation():
    return load_simulation_results()
