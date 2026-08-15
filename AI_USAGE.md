# AI_USAGE.md

Running table, updated daily — not reconstructed at the end. Rule: AI wrote boilerplate, plotting,
API glue, CRUD. We hand-wrote the feature builder, quantile handling, inventory math, and guardrails
— an auditor will point at those and ask us to explain them line by line.

| file / component | AI-assisted or hand-written | what the AI produced | what we changed and why |
|---|---|---|---|
| repo scaffold (this initial commit) | AI-assisted | folder structure, boilerplate FastAPI/Streamlit routes, mock generator, Makefile, Dockerfile | reviewed every file; inventory math, feature-leakage logic, and guardrail thresholds were written to match the plan's explicit formulas, not left to AI defaults |
| src/inventory/safety_stock.py | hand-written (AI-reviewed) | — | derived from the plan's corrected protection-interval formula; each function pinned to the exact math, no AI-generated shortcuts |
| src/data/features.py | hand-written (AI-reviewed) | — | origin-truncation logic written and tested explicitly to prevent the #1 silent leakage bug |
| src/api/routes/*.py | AI-assisted | CRUD scaffolding | reviewed for correctness against CONTRACTS.md |
| src/ui/pages/*.py | AI-assisted | Streamlit page boilerplate | reviewed, wired to the real API contract |

Update this table every day per stream. Each pair reviews their own rows before Day 6 submission.
