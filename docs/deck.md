# StockPilot: Autonomous Demand & Replenishment Control Tower

````carousel
# 1. The Challenge
Supply chain planners face overwhelming data volume and volatile demand. Traditional tools offer static forecasts and rigid thresholds, leading to:
- **Excess Inventory** (High holding costs)
- **Stockouts** (Lost revenue and goodwill)
- **Manual Overhead** (Time spent tweaking spreadsheets)

**Goal**: Build an autonomous, agentic control tower to optimize inventory dynamically.
<!-- slide -->
# 2. Our Solution: StockPilot
StockPilot is an end-to-end system that:
1. **Forecasts demand** with probabilistic confidence bounds.
2. **Simulates inventory** to predict stockouts before they happen.
3. **Recommends purchase orders** with clear, AI-generated rationale.
4. **Keeps humans in the loop** for final approval with guardrail checks.

**Tech Stack**: DuckDB, LightGBM, FastAPI, React/Vite, LangGraph.
<!-- slide -->
# 3. Data & Forecasting (Pair A)
- **Data Engineering**: Processed the Olist e-commerce dataset using DuckDB. Strict point-in-time features to prevent data leakage.
- **Modeling**: LightGBM Quantile regressors (P10, P50, P90) to capture uncertainty, not just point estimates.
- **Explainability**: Integrated SHAP values to explain the top drivers for each forecast.
<!-- slide -->
# 4. Inventory Optimization (Pair B)
- **Dynamic Safety Stock**: Calculated based on forecast error over the lead-time protection interval (L+R).
- **Three-Arm Simulator**: Compares our policy against the baseline and incumbent systems to prove ROI.
- **Constraints**: Enforces MOQ, pack sizes, and budget caps seamlessly.
- **Results**: Demonstrated a **75.5% forecast accuracy lift**, an **8.5% cost reduction**, and eliminated **39 stockout-days**.
<!-- slide -->
# 5. Agentic Orchestration (Pair 4)
- **LangGraph State Machine**: Orchestrates the workflow: Data Quality → Forecast → Risk → Planner → Guardrails → Human Approval → Execute.
- **Explainable AI**: The LLM doesn't do math. It simply explains the deterministic recommendation using cached templates for reliability.
- **Durable Execution**: The process pauses for human approval and resumes flawlessly.
<!-- slide -->
# 6. The Control Tower Experience (Pair C)
- **Modern UI**: A React-based, Stitch-inspired dark mode interface built for speed and clarity.
- **Approval Queue**: Review recommendations with AI-generated narratives and clear ROI impact.
- **What-If Simulator**: Tweak price, discount, and lead time to see immediate impact on projections.
- **Audit Trace**: Full transparency into what the agent did and when the human intervened.
````
