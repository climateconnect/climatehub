# Sentry Configuration

This document describes how Sentry is configured across the Climate Connect stack (frontend + backend), with a focus on GDPR data minimisation.

**Last Updated**: June 2026

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Frontend Configuration](#frontend-configuration)
4. [Backend Configuration](#backend-configuration)
5. [PII Protection](#pii-protection)
6. [Maintaining the PII Field List](#maintaining-the-pii-field-list)
7. [Environment Variables](#environment-variables)
8. [EU Data Region & DPA](#eu-data-region--dpa)
9. [Privacy Policy](#privacy-policy)
10. [Troubleshooting](#troubleshooting)

---

## Overview

Sentry is used for error monitoring and performance tracing across the stack. The configuration is GDPR-compliant under **legitimate interest** (Art. 6(1)(f) GDPR) — no user consent is required. Data is stored in the EU region.

Key design decisions:
- **No consent gating** — Sentry runs for all users (maximises error visibility)
- **No request body capture on the client** — `dataCollection.httpBodies: []`
- **Field-level PII redaction on the backend** — known PII fields replaced with `"[REDACTED]"`
- **No local variable PII leakage** — `event_scrubber` with extended denylist

---

## Architecture

```
Browser ──POST /api/edit_profile/──→ Django API
   │                                      │
   │ GET /projects/erlangen               │ Response (200/500)
   │                                      │
   ▼                                      ▼
Next.js SSR ──GET /api/projects/──→ Django API
```

| Sentry instance | Runtime | Config file | What it captures |
|-----------------|---------|-------------|-----------------|
| Client | Browser | `frontend/instrumentation-client.ts` | JS errors, navigation performance |
| Server | Node.js (SSR) | `frontend/sentry.server.config.ts` | SSR errors, server-side rendering |
| Edge | Edge runtime | `frontend/sentry.edge.config.ts` | Middleware errors |
| Backend | Django + Celery | `backend/climateconnect_main/settings.py` | API errors, Celery task errors, DB errors |

---

## Frontend Configuration

### Client (`instrumentation-client.ts`)

```typescript
Sentry.init({
  dsn: process.env.FRONTEND_SENTRY_DSN,
  tracesSampleRate: 0.1,
  enableLogs: false,
  enabled: process.env.NODE_ENV === "production",
  dataCollection: {
    userInfo: false,
    cookies: false,
    httpHeaders: false,
    httpBodies: [],        // No request bodies — PII risk
    queryParams: true,     // Kept — hub slugs, page numbers
  },
  beforeSend(event) {
    // Defense in depth — strip residual request data
    if (event.request) {
      delete event.request.data;
      delete event.request.headers;
      delete event.request.cookies;
    }
    delete event.user;
    return event;
  },
});
```

**Key points:**
- `dataCollection` replaces deprecated `sendDefaultPii` (removed in v11)
- `httpBodies: []` prevents capturing outgoing request bodies (form data with PII)
- `queryParams: true` — kept because Climate Connect URLs only contain public hub slugs and page numbers
- `beforeSend` strips residual request data as defense in depth

### Server/Edge (`sentry.server.config.ts`, `sentry.edge.config.ts`)

```typescript
Sentry.init({
  dsn: process.env.FRONTEND_SENTRY_DSN,
  enabled: process.env.NODE_ENV === "production",
  enableLogs: false,
  tracesSampleRate: 0.2,
  dataCollection: {
    userInfo: false,
    cookies: false,
    httpHeaders: false,
    // httpBodies kept — server only does SSR fetching of public page data
    queryParams: false,
  },
});
```

**Key points:**
- `httpBodies` kept at defaults — the Next.js server only handles SSR data fetching from the Django API (public page data). User form submissions go browser → Django API directly.
- `tracesSampleRate: 0.2` — 20% of transactions captured

---

## Backend Configuration

### `settings.py` — `sentry_sdk.init()`

```python
from sentry_sdk.scrubber import EventScrubber, DEFAULT_PII_DENYLIST

sentry_sdk.init(
    dsn=SENTRY_DSN,
    integrations=[DjangoIntegration(), CeleryIntegration(), RedisIntegration()],
    traces_sample_rate=0.2,
    send_default_pii=False,
    event_scrubber=EventScrubber(pii_denylist=_PII_DENYLIST),
    before_send=_sentry_before_send,
    environment=SENTRY_ENVIRONMENT,
)
```

**Integrations:**
- `DjangoIntegration` — captures Django view errors, middleware errors, template errors
- `CeleryIntegration` — captures background task errors (email sending, notifications)
- `RedisIntegration` — captures Redis connection errors

---

## PII Protection

PII protection operates in layers:

### Layer 1: SDK configuration

| Setting | Effect |
|---------|--------|
| `send_default_pii=False` (backend) | Disables IP, user agent, headers, cookies, user info |
| `dataCollection` (frontend) | Disables identity, cookies, headers, request bodies (client) |

### Layer 2: `before_send` hook (backend)

Redacts known PII fields in `request.data` to `"[REDACTED]"`. Preserves the data structure for debugging — you can see which fields were submitted without seeing the actual personal data.

Always strips: headers, cookies, user object.

### Layer 3: `event_scrubber` (backend)

The `EventScrubber` runs on the **entire event payload** — request data, local variables in stack frames, breadcrumbs, exception values. This catches PII in Celery task failures where local variables like `user` (Django User object) or nested dict keys like `Email` (Mailjet payload) would otherwise leak.

### Layer 4: Server-side scrubbing rules (Sentry UI)

Configured in the Sentry project settings as a final safety net for residual PII patterns in error messages.

### What is NOT protected

- **Error messages** — free-form text from Django or third-party libraries could theoretically contain PII. The `event_scrubber` catches common patterns but cannot guarantee 100% coverage.
- **Variable names not in the denylist** — a variable named `recipient_email` would NOT be caught by the `email` entry. The scrubber does exact, case-sensitive key matching.
- **Object attributes** — the scrubber matches dict keys, not object attributes. A Django model's `.email` attribute is only caught if the variable holding the model is itself in the denylist (e.g., `user`).

### Twingle webhook

`POST /api/webhooks/twingle/` receives Twingle's full donor payload (name, email, address, IBAN). The global
layers above don't cover it: `before_send` and the scrubber redact by field name and only at the top level,
Twingle's field names aren't on the list, and performance transactions (`traces_sample_rate=0.2`) skip
`before_send` but carry the request body and headers, including `X-Hub-Signature-256`.

So the view registers one event processor, `_strip_request_data` in
`climateconnect_api/views/twingle_webhook_views.py`, for its own request only. It runs for errors, messages
and transactions of that request and removes the request data (body, headers, cookies, query string),
breadcrumbs, `extra` and the local variables of every stack frame. Stack traces, tags, the fixed message,
the transaction name, timings and spans are kept. No global Sentry setting was changed.

- The processor is registered on both the request's isolation scope and its current scope. Django's
  WSGI-style request processor sits on the current scope, and current-scope processors run after
  isolation-scope ones, so a processor on the isolation scope alone would run too early.
- Problems caused by the payload are reported as fixed-text messages with a `twingle_reason` tag, never as
  exceptions, because parser errors echo their input.
- `test_twingle_webhook.SentryPrivacyTests` sends requests through the real WSGI and ASGI handlers with
  tracing at 100 % and checks that no payload value or signature appears in any serialized event. If it
  ever can't pass, the approved fallback is a `traces_sampler` that returns 0 for this path.

See [Twingle donation webhook](twingle-donation-webhook.md) for operations.

---

## Maintaining the PII Field List

The `_SENTRY_PII_FIELDS` frozenset in `backend/climateconnect_main/settings.py` defines which field names are redacted. **This list must be kept up to date** when:

1. **New API endpoints** are added that accept personal data (new form fields, new user-facing features)
2. **New Celery tasks** are added that process personal data (new email templates, new notification types)
3. **New Mailjet template variables** are added (check the `variables` dict in email utility functions)
4. **Existing fields are renamed** in serializers or views

### How to add a new PII field

1. Add the field name to `_SENTRY_PII_FIELDS` in `settings.py`
2. Add a comment explaining which endpoint or task uses it
3. The `event_scrubber` automatically picks it up via `_PII_DENYLIST`
4. Run `pdm run ruff format climateconnect_main/settings.py`

### How to verify the list is correct

Search the codebase for `request.data[` and `request.data.get(` to find all field names used in views. Compare against `_SENTRY_PII_FIELDS`. The API documentation in `doc/api-documentation.md` also lists endpoint field names.

### Current field list (22 entries, June 2026)

| Category | Fields |
|----------|--------|
| Identity | `username`, `email`, `email_address`, `first_name`, `last_name`, `biography` |
| Profile images | `image`, `thumbnail_image`, `background_image` |
| Credentials | `password`, `old_password`, `new_password`, `confirm_password`, `password_reset_key` |
| Auth tokens | `session_key`, `code` |
| Free text | `message_content`, `message`, `content` |
| Registration | `custom_field_answers` |
| Local variables | `user` (Django User object in stack frames) |
| Nested dicts | `Email` (Mailjet API payload key) |

---

## Environment Variables

| Variable | Where | Description |
|----------|-------|-------------|
| `SENTRY_DSN` | Backend `.backend_env` | Sentry DSN for the backend project |
| `SENTRY_ENVIRONMENT` | Backend `.backend_env` | Environment label (`production`, `staging`, etc.) |
| `FRONTEND_SENTRY_DSN` | Frontend `.env` / Azure App Settings | Sentry DSN for the frontend project |
| `SENTRY_AUTH_TOKEN` | CI secrets only (NOT in client env) | Auth token for source map uploads at build time |

**Important**: `SENTRY_AUTH_TOKEN` must NOT be in the `next.config.js` `env` block — it would be exposed to the client bundle.

---

## EU Data Region & DPA

- **EU data region**: ✅ Sentry account is configured to store data in the EU
- **DPA signed**: ✅ Sentry Data Processing Addendum is in place
- **No SCCs or EU-U.S. DPF reliance needed** — data stays within the EU

---

## Privacy Policy

The Webflow-hosted privacy policy must mention Sentry as a subprocessor and document error monitoring as a legitimate interest under Art. 6(1)(f) GDPR. This is a content/legal task, not a code change.

---

## Troubleshooting

### Sentry not sending events in local development

This is expected. `SENTRY_DSN` is not set in `.backend_env` and `enabled: process.env.NODE_ENV === "production"` disables the frontend SDK.

### How to test PII redaction locally

```python
# In Django shell
from climateconnect_main.settings import _sentry_before_send

event = {"request": {"data": {"first_name": "Jane", "name": "Bike Action"}}}
result = _sentry_before_send(event, {})
# result['request']['data']['first_name'] == '[REDACTED]'
# result['request']['data']['name'] == 'Bike Action'
```

### How to test EventScrubber denylist

```python
from climateconnect_main.settings import _PII_DENYLIST

assert 'email' in _PII_DENYLIST
assert 'user' in _PII_DENYLIST
assert 'Email' in _PII_DENYLIST
```

---

**Spec**: `doc/spec/20260611_1347_sentry_gdpr_compliance.md`
