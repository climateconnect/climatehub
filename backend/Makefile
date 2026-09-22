default: all


start:
	$(info )
	$(info -- Starting server --)
	$(info )
	python3 manage.py runserver

# Starts both workers the platform needs: the default one and the `lookup` one
# that consumes location autocomplete jobs (CELERY_TASK_ROUTES routes
# location.tasks.fetch_autocomplete to the `lookup` queue, so the default worker
# never picks those up and autocomplete silently degrades without this).
# Both run in the background under an explicit trap, because sh starts async
# jobs with SIGINT ignored — without the trap, Ctrl-C would leave the lookup
# worker running. Use `make celery_lookup` when you want that one on its own.
celery:
	$(info )
	$(info -- Starting Celery --)
	$(info )
	@trap 'kill $$DEFAULT_PID $$LOOKUP_PID 2>/dev/null' EXIT INT TERM; \
	celery -A climateconnect_main worker -l INFO & DEFAULT_PID=$$!; \
	celery -A climateconnect_main worker -Q lookup -c 4 -l INFO & LOOKUP_PID=$$!; \
	wait

celery_beat:
	$(info )
	$(info -- Starting Celery Beat --)
	$(info )
	celery -A climateconnect_main beat -l INFO

# Only the lookup worker, for when you are working on the autocomplete feature
# itself. For normal development use `make celery`, which starts this one too.
celery_lookup:
	$(info )
	$(info -- Starting Celery worker for location autocomplete (queue: lookup) --)
	$(info )
	celery -A climateconnect_main worker -Q lookup -c 4 -l INFO

shell:
	python3 manage.py shell

install:
	pdm install

test:
	python3 manage.py test --keepdb --noinput --parallel 4
test-clean:
	python3 manage.py test --noinput

coverage:
	$(info )
	$(info -- Running tests with coverage --)
	$(info )
	coverage run manage.py test --keepdb --noinput
	coverage report

coverage-html:
	$(info )
	$(info -- Running tests with coverage (HTML report) --)
	$(info )
	coverage run manage.py test --keepdb --noinput
	coverage html
	$(info )
	$(info -- Report written to htmlcov/index.html --)
	$(info )

docker:
	docker-compose up -d
	$(info )
	$(info -- Running Docker in background (detached mode) --)
	$(info )


# Note: this should be in sync with out CI GitHub action that lints too. See
# those files under .github/workflows
# lint:
#  	 flake8 . --count --select=E9,F6,F7,F8 --show-source --statistics
ruff:
	ruff check .

format:
	black .

# Database migrations and test data creation:
migrate:
	python3 manage.py migrate

migrations: migrate

test-data:
	python3 manage.py create_test_data --number_of_rows 4

all: format ruff start

precommit: format ruff

precommit-full: format ruff test
