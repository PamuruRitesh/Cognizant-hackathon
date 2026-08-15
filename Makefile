.PHONY: setup mocks data train api ui demo test plan

setup:
	python3 -m venv .venv && . .venv/bin/activate && pip install -r requirements.txt --break-system-packages

mocks:
	python3 scripts/make_mocks.py

data:
	python3 src/data/load_data.py

train:
	python3 src/forecast/pipeline.py

api:
	uvicorn src.api.main:app --reload --port 8000

ui:
	streamlit run src/ui/app.py

plan:
	python3 -m src.agents.graph

demo:
	DEMO_MODE=true docker compose up --build

test:
	python3 -m pytest tests/ -v
