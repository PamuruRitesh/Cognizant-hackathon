# StockPilot Demo Script

## Preparation
1. Run `make demo` in the terminal to start the environment.
2. Open `http://localhost:5173` in your browser.
3. Keep the terminal visible on the side to show the Docker logs if needed.

## Script

**Speaker 1 (Intro & Architecture):**
> "Hello everyone, we are presenting StockPilot, an autonomous demand and replenishment control tower. Our goal was to eliminate manual spreadsheets and static thresholds that lead to stockouts and excess inventory. We've built an agentic system that forecasts demand, simulates inventory, and drafts purchase orders, all while keeping a human in the loop."

> "Let's look at the UI. The Control Tower is built in React with a 'Stitch-inspired' aesthetic — playful but premium enterprise-grade design."

**Speaker 2 (Forecasting & UI Walkthrough):**
> "At the top, you see our KPIs. Down here is the Risk Heatmap. But let's dive into a specific product."
*(Action: Click on a SKU to open the SKUDetail view)*
> "For our forecasting, we didn't just build a point estimate. Using LightGBM Quantile regressors on Olist data, we generate P10, P50, and P90 confidence bands. Notice the fan chart — it visually communicates uncertainty to the planner."

**Speaker 1 (Inventory Math & Simulation):**
*(Action: Scroll to or click on the What-If Simulator)*
> "Of course, a forecast is useless without inventory optimization. We use a dynamic safety stock model calculated over the protection interval. We can even simulate scenarios. Let's tweak the lead time or price and see how our projections change in real-time."
*(Action: Move a slider in the What-If Simulator and watch the chart update)*

**Speaker 2 (Agent Orchestration & The Approval Queue):**
*(Action: Navigate to the Approval Queue)*
> "This is where the magic happens. Our LangGraph state machine orchestrates the whole pipeline. The agent generates replenishment recommendations based on the forecasts and guardrail constraints (like budget and MOQ). But instead of blind automation, it pauses for human approval."

> "Notice the narrative text next to the recommendation? That's our Explainer node. The LLM isn't doing any math — it's taking the deterministic outputs and explaining the 'why' in plain English to build trust with the planner."

**Speaker 1 (Action & Audit):**
*(Action: Click 'Approve' on a recommendation)*
> "When the planner hits approve, the graph resumes execution and creates the purchase order. And everything is logged."
*(Action: Show the Audit Trace component)*
> "The Audit Trace gives full transparency into what the system did and when the human intervened."

**Closing:**
> "StockPilot: turning reactive supply chains into proactive, explainable autonomous engines. Thank you!"
