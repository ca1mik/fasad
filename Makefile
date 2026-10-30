SHELL := /bin/sh

.PHONY: up down logs backend frontend scheduler-logs worker-logs migrate makemigrations seed test lint format

up:
	docker compose up --build -d

down:
	docker compose down

logs:
	docker compose logs -f

backend:
	docker compose exec backend sh

frontend:
	docker compose exec frontend sh

scheduler-logs:
	docker compose logs -f scheduler

worker-logs:
	docker compose logs -f worker

migrate:
	docker compose exec backend alembic upgrade head

makemigrations:
	docker compose exec backend alembic revision --autogenerate -m "$${m:-manual_revision}"

seed:
	docker compose exec backend python scripts/seed.py

test:
	docker compose exec backend pytest -q

lint:
	docker compose exec backend ruff check app scripts
	docker compose exec backend black --check app scripts
	docker compose exec frontend npm run lint

format:
	docker compose exec backend black app scripts
	docker compose exec backend ruff check --fix app scripts

