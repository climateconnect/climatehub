# Backend logging review

**Status**: DRAFT (no GitHub issue yet)
**Date**: 2026-11-16
**Found during**: spec work for #2388 (Twingle donation goal webhook), system impact analysis (finding I3)
**Type**: review task: inventory, decide, document. This spec records findings only. **No decisions are made here**; making them is the purpose of the task.

---

## Goal

Backend logging should be useful when it's needed: in production, to understand what happened, and in local development, as a tool (e.g. seeing an OTP code or a verification email without sending one). Today neither is designed; it grew per feature.

The task produces:
1. an inventory of all logging (and `print`) in the backend,
2. decisions on what should be logged where, at which level, in which environment,
3. a logging config and code changes that implement those decisions,
4. documentation for developers (how to log, and how to see dev-only output locally).

Constraint already set by Harald: **no root logger at INFO**.

---

## Findings (2026-11-16, `master` 1045c9f2d)

### F1. Configuration

`backend/climateconnect_main/settings.py:549`:

```python
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {"simple": {"format": "{levelname} {message}", "style": "{"}},
    "handlers": {"console": {"level": "INFO", "class": "logging.StreamHandler"}},
    "loggers": {"django": {"handlers": ["console"], "level": "INFO"}},
}
```

- Only the `django` logger has a handler.
- The `simple` formatter is defined but not used by any handler.
- The root logger isn't configured: no handler, default level WARNING.
- No environment-dependent behaviour (e.g. DEBUG or a `LOG_LEVEL` variable).

### F2. What reaches the output, by process

Module loggers (`logging.getLogger(__name__)`) propagate to the root logger. With no handler there, Python's last-resort handler prints WARNING and above to stderr, with no level name, logger name or timestamp. INFO and DEBUG are dropped.

| Process | Module-logger INFO | WARNING/ERROR | Notes |
|---|---|---|---|
| Web (gunicorn + uvicorn worker) | dropped | bare message on stderr | Verified by archie with the project settings loaded. Gunicorn's uvicorn worker doesn't configure the root logger. |
| Celery worker | visible | visible, formatted | Celery configures root logging itself. |
| Management commands | dropped | bare message | Same config as web; commands may also write via `self.stdout`. |
| Local `runserver` | dropped | bare message | Same as web. |

To verify during the task: the web row in production (App Service log stream), and whether Azure adds timestamps.

### F3. Inventory size (outside tests and migrations)

- **Logger setup**: 38 × `getLogger(__name__)`, 4 × `getLogger("django")`. The `location` app (`location_views.py`, `utility.py`, `cache.py`, `providers.py`) uses the `django` logger, probably as a workaround for F2: its INFO lines are the only module INFO lines visible in the web process.
- **`logger.info`**: about 40 calls. In web code (dropped today): `organization/views/event_registration_views.py` (6), `organization/views/project_views.py` (5), `feature_toggles/admin.py` (5), `organization/views/organization_views.py` (3), `auth_app/views.py` (2), plus single calls in `chat_messages`, `ideas`, `organization/utility/requests.py`. In Celery tasks (visible): `organization/tasks.py` (6), `location/tasks.py` (2), `climateconnect_api/tasks.py` (2).
- **`logger.warning` / `error` / `exception`**: about 116 calls.
- **`print()`**: 37 files outside tests and migrations. Examples:
  - debug leftovers: `climateconnect_api/serializers/badge.py:38` `print(obj)`, `ideas/views/idea_views.py:228`, `climateconnect_api/views/user_views.py:99`
  - real error reporting via `print`: `climateconnect_api/utility/email_setup.py:332` (failed verification email). This never reaches Sentry and has no level.
  - messages that include user objects: `organization/permissions.py:324`, `organization/utility/requests.py:186`

### F4. Logging that matters but is invisible today

- **Rate limiting** (`auth_app/views.py:34`, `:183`): "Rate limited request from IP …" at INFO. Dropped in production, so abuse of the login endpoints leaves no trace in the logs (`LoginAuditLog` in the database still records attempts).
- **Event registration and project views**: INFO lines added by recent features (registration, waitlist preparation, join requests) are invisible.
- **Twingle webhook (#2388)**: needs one visible INFO line per counter change (spec T9, solved there with one dedicated logger entry). It should fit whatever this task decides.

### F5. Local development output

- **OTP code**: `auth_app/utility/email.py:18`. When `LOGIN_CODE_EMAIL_TEMPLATE_ID` is blank, the code is logged at **WARNING** together with the user's email (documented in `doc/environment-variables.md:269`). WARNING is presumably used because INFO wouldn't show (F2). Side effects:
  - If the template id were ever blank in production, OTP codes and emails would land in the production log.
  - WARNING records become Sentry breadcrumbs (F6).
- **Other dev conveniences**: to inventory, e.g. verification and reset emails without Mailjet, `print` in `email_setup.py`.
- No documented way for a developer to turn on more output locally.

### F6. Interplay with Sentry

- Sentry's `LoggingIntegration` is active by default (not configured explicitly): log records at INFO and above become **breadcrumbs**, and ERROR records become **Sentry events**. This uses the logger's level, not our handlers. So:
  - each `logger.error(...)` creates a Sentry issue, including f-string messages such as `EmailFailure: Error sending email -> {mail.text}` (`email_setup.py:407`, `:453`). Exception messages aren't scrubbed by the `EventScrubber` (see `doc/spec/20261116_1600_sentry_transaction_pii_gap.md`).
  - if module loggers are raised to INFO, their INFO lines start appearing as breadcrumbs on Sentry events. That's useful for debugging, but it's PII-relevant (breadcrumb `data` is scrubbed, the message isn't).
- To check during the task: which `logger.error` messages can contain personal data (emails, names, Mailjet response bodies).

### F7. Conventions in use (inconsistent)

- Message style varies: `[send_login_code_email] …` prefixes, `EmailFailure: …`, plain text.
- Both f-strings and `%`-style lazy arguments are used.
- `logger.error(f"... {exc}")` vs `logger.exception(...)`: stack traces are mostly lost.
- No documentation on logging in `backend/agent.md`, `doc/backend-development.md` or `doc/architecture.md`. `doc/environment-variables.md` has a "Monitoring & Logging" section (line 487) and per-variable notes.

---

## Questions to decide (in the task, not here)

1. **Purpose per level**: what is DEBUG, INFO, WARNING, ERROR for in this project? What must be visible in production, what only locally?
2. **Which loggers get handlers at which level**, per environment (production, staging, local, tests, Celery)? Constraint: no root at INFO.
3. **Environment control**: driven by `DEBUG`, a new variable such as `LOG_LEVEL`, or per-logger settings?
4. **Format**: level, logger name, timestamp? Does Azure's log stream already add a timestamp?
5. **Dev-only output** (OTP, emails without Mailjet): which mechanism and level, and how to guarantee it can't leak in production (e.g. tied to `DEBUG`, or refusing to start without the template id in production)?
6. **`print()`**: remove, convert to logging, or keep in management commands (`self.stdout`)?
7. **`getLogger("django")` in `location`**: keep or move to `__name__` once the config is fixed?
8. **Sentry**: should the `LoggingIntegration` be configured explicitly (breadcrumb and event levels)? Which `logger.error` calls should rather be warnings, or use `logger.exception`?
9. **PII in log messages**: rules for what may appear in a log line (user id yes, email no?), and how existing messages are brought in line.
10. **Twingle T9**: keep the dedicated logger entry, or replace it with the general solution?

## Deliverables

- Inventory table (file, line, level, purpose, process, contains PII?, decision) under `doc/` or as an appendix to this spec.
- Decisions on the questions above, recorded in this spec.
- Implementation: `LOGGING` config, code changes from the inventory, tests where behaviour depends on config (e.g. "logger X is enabled for INFO in production config").
- Documentation:
  - a logging section for developers (where to log, levels, PII rules, how to see dev output), e.g. in `doc/backend-development.md`, referenced from `backend/agent.md`;
  - `doc/environment-variables.md` updated if a variable is added;
  - `doc/sentry.md` updated if the logging integration changes.

## Out of scope

- Log shipping or aggregation (e.g. Loki/Grafana for application logs).
- Frontend logging.
- The Sentry PII gaps on transactions (separate draft: `doc/spec/20261116_1600_sentry_transaction_pii_gap.md`), except where logging affects Sentry (F6).

## Log

- 2026-11-16: Findings drafted from the #2388 system impact analysis and a code inventory. No decisions; next step is for Harald to decide whether to create a GitHub issue and when to schedule the review.
