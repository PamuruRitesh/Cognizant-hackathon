import os
import pandas as pd
from fastapi import APIRouter, HTTPException

router = APIRouter(tags=["aerospace"])

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
PROCESSED_DIR = os.path.join(REPO_ROOT, "data", "processed")

@router.get("/aerospace/metrics")
def get_aerospace_metrics():
    metrics_file = os.path.join(PROCESSED_DIR, "aerospace_backtest_metrics.csv")
    if not os.path.exists(metrics_file):
        raise HTTPException(status_code=404, detail="Metrics file not found. Run the aerospace pipeline first.")
    
    df = pd.read_csv(metrics_file)
    return df.to_dict(orient="records")

@router.get("/aerospace/forecast")
def get_aerospace_forecast(limit: int = 100):
    # Try the root forecast.csv first, then data/processed/forecast.csv
    forecast_file = os.path.join(REPO_ROOT, "forecast.csv")
    if not os.path.exists(forecast_file):
        forecast_file = os.path.join(PROCESSED_DIR, "forecast.csv")
        
    if not os.path.exists(forecast_file):
        raise HTTPException(status_code=404, detail="Forecast file not found.")
    
    df = pd.read_csv(forecast_file)
    return df.head(limit).to_dict(orient="records")

import duckdb

def get_duckdb_con():
    db_path = os.path.join(REPO_ROOT, "aerospace.duckdb")
    return duckdb.connect(db_path, read_only=True)

@router.get("/aerospace/parts")
def get_parts():
    con = get_duckdb_con()
    try:
        # Get parts that have POs
        query = """
            SELECT DISTINCT pm.part_id, pm.part_family, pm.criticality_class 
            FROM parts_master pm
            JOIN purchase_orders po ON pm.part_id = po.part_id
            ORDER BY pm.part_id
        """
        df = con.execute(query).df()
        return df.to_dict(orient="records")
    finally:
        con.close()

@router.get("/aerospace/parts/{part_id}/vendors")
def get_part_vendors(part_id: str):
    con = get_duckdb_con()
    try:
        query = """
            SELECT 
                po.supplier_id,
                COUNT(po.po_id) as orders,
                CAST(SUM(po.ordered_qty) AS INTEGER) as total_quantity,
                AVG(po.receipt_date - po.order_date) as avg_lead_time,
                CAST((SUM(CASE WHEN po.receipt_date <= po.promised_date THEN 1 ELSE 0 END) * 100.0 / COUNT(po.po_id)) AS DOUBLE) as on_time_delivery_pct,
                AVG(po.receipt_date - po.promised_date) as avg_delay_days,
                MAX(pm.unit_cost) as unit_cost,
                MAX(pm.supplier_risk_class) as supplier_risk_class
            FROM purchase_orders po
            JOIN parts_master pm ON pm.part_id = po.part_id
            WHERE po.part_id = ?
            GROUP BY po.supplier_id
        """
        df = con.execute(query, [part_id]).df()
        
        # Quality incidents for defect rate
        q_query = """
            SELECT supplier_id, COUNT(incident_id) as incidents, CAST(SUM(scrap_qty) AS INTEGER) as total_scrap
            FROM quality_incidents
            WHERE part_id = ?
            GROUP BY supplier_id
        """
        q_df = con.execute(q_query, [part_id]).df()
        
        # Merge metrics
        merged = pd.merge(df, q_df, on='supplier_id', how='left')
        merged['incidents'] = merged['incidents'].fillna(0).astype(int)
        merged['total_scrap'] = merged['total_scrap'].fillna(0).astype(int)
        
        # Defect rate % = (scrap / total_quantity) * 100
        merged['defect_rate_pct'] = (merged['total_scrap'] / merged['total_quantity']) * 100
        merged['defect_rate_pct'] = merged['defect_rate_pct'].fillna(0)
        
        return merged.to_dict(orient="records")
    finally:
        con.close()

@router.get("/aerospace/parts/{part_id}/vendors/{supplier_id}/logs")
def get_vendor_logs(part_id: str, supplier_id: str):
    con = get_duckdb_con()
    try:
        po_query = """
            SELECT 
                CAST(order_date AS VARCHAR) as order_date, 
                po_id, 
                CAST(ordered_qty AS INTEGER) as ordered_qty, 
                CAST(receipt_date AS VARCHAR) as receipt_date, 
                CAST(promised_date AS VARCHAR) as promised_date,
                pm.unit_cost
            FROM purchase_orders po
            JOIN parts_master pm ON pm.part_id = po.part_id
            WHERE po.part_id = ? AND po.supplier_id = ?
            ORDER BY po.order_date DESC
            LIMIT 500
        """
        po_df = con.execute(po_query, [part_id, supplier_id]).df()
        
        q_query = """
            SELECT 
                CAST(incident_date AS VARCHAR) as incident_date, 
                incident_id, 
                defect_severity, 
                defect_type, 
                CAST(scrap_qty AS INTEGER) as scrap_qty
            FROM quality_incidents
            WHERE part_id = ? AND supplier_id = ?
            ORDER BY incident_date DESC
            LIMIT 500
        """
        q_df = con.execute(q_query, [part_id, supplier_id]).df()
        
        return {
            "purchase_orders": po_df.to_dict(orient="records"),
            "quality_incidents": q_df.to_dict(orient="records")
        }
    finally:
        con.close()
