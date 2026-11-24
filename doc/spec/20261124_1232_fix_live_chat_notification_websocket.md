# Fix the live chat and notification websocket

**Status**: DRAFT (problem statement and findings complete, awaiting Harald's review; System impact pending Archie)
**Type**: Backend + Frontend + Ops: bug fix. No data model change.
**Date created**: 2026-11-24
**Issue**: none yet (Harald decides when to create one)

**Related**:
- `doc/spec/20260826_1138_container_based_deployment_pipeline.md`: container-based backend deployment. Part B of this task (websocket host) is tied to the domain decision that comes with it.
- PR #2410 (dependency update, Knox 5 → 6): out of scope, but the knox token lookup used here must work with Knox 6 (REST token auth with Knox 6 is verified).
- Issue #710 / PR #709: old TODOs in `_app.tsx` about socket state updates remounting FAQ elements.

**Touches** (areas, not a design):
- Backend: `backend/climateconnect_main/token_auth.py`, `backend/climateconnect_main/routing.py`, `backend/climateconnect_main/asgi.py` (entry point, probably unchanged), `backend/chat_messages/consumer.py`, `backend/chat_messages/views/message_views.py` (`SendChatMessage`), `backend/climateconnect_api/utility/notification.py` (`send_out_live_notification`), `backend/climateconnect_main/settings.py` (`CHANNEL_LAYERS`, CORS/CSRF/ALLOWED_HOSTS if the API host changes)
- Frontend: `frontend/pages/_app.tsx` (socket setup, ~lines 205–260), `frontend/public/lib/webSockets.ts`, `frontend/public/lib/cookieOperations.ts` (cookie domain, read only unless a decision changes it), consumers of `chatSocket`: `frontend/pages/chat/[chatUUID].tsx`, `frontend/src/components/communication/chat/ChatDrawer.tsx`, `frontend/src/components/context/UserContext.ts`
- Build/ops: GitHub secrets `SOCKET_URL`, `API_URL`, `BASE_URL_HOST` used by `.github/workflows/master_climateconnect-frontend-appservice(slot2).yml` and `.github/workflows/frontend-container-build.yml`, exposed via `frontend/next.config.js`; Azure app settings of the frontend and backend App Services
- Docs: `doc/architecture.md`, `doc/environment-variables.md`, `doc/api-documentation.md` (websocket contract), `doc/mosy/flows/` (chat flow, if documented there)

---

## Problem Statement

The frontend opens a websocket to `/ws/chat/` after login. It is meant to deliver live updates: a new chat message appears in an open chat and the notification badge updates without a page reload. **This has not worked in production for a long time.** Users only see new messages and notifications after reloading or navigating.

Three independent problems are stacked. Each one hides the next, so fixing only the visible error would not make the feature work:

1. **The backend crashes on every websocket connection.** The auth middleware is written for Channels 2. On Channels 4 every handshake fails with a 500.
2. **The login cookie never reaches the websocket host.** Production connects to `wss://api.climateconnect.earth`, but the `token` cookie is scoped to `.climatehub.org`. Even with problem 1 fixed, every connection would be anonymous and closed.
3. **The frontend never really reconnects.** After the first disconnect (Azure drops idle connections after a few minutes), it reuses the closed socket object. Live updates stop until reload.

While writing this spec, more gaps were found that matter once the socket works again (see "Additional findings" under AI Agent Insights). The most important: **the websocket path for sending a chat message skips the authorization checks of the REST path.** Today it's unreachable because of problem 1. Fixing problem 1 alone would open it.

**Why it matters**: chat is the main way members of projects, organisations and hubs coordinate. Without live updates, conversations feel broken (messages "arrive" late, unread counts are stale), and people move to other channels. The broken socket also produces about 18,000 Sentry errors in two months, which buries real errors.

---

## Delivery parts and dependencies

| Part | Content | Depends on | Can ship |
|---|---|---|---|
| **A1: Backend handshake** | Middleware works on Channels 4 (problem 1), consumer edge cases, Channels tests | nothing | anytime |
| **A2: Safe message path** | Socket and REST send paths enforce the same rules; receivers get a live event whichever path the sender used | Decision D1 | anytime, **must ship with or before A1** |
| **A3: Frontend reconnect** | New socket on reconnect, backoff, no reconnect when logged out, cleanup, message handlers survive reconnects (problem 3) | nothing | anytime |
| **B: Websocket host** | Production `SOCKET_URL` (and maybe `API_URL`) points at a host that receives the `token` cookie (problem 2) | Decision D2 (domain strategy, tied to the container migration) | after D2 |
| **C: Production verification** | Long-lived connections on the chosen backend hosting, channel layer over Redis in prod, Sentry clean | A1, A2, B | last |

A1 + A2 + A3 can be merged and deployed without B. They make no visible difference in production until B ships, but they stop the Sentry noise (A1), close the authorization gap before it becomes reachable (A2), and can be tested end to end locally and against slot2.

---

## User Stories

- As a **member in a chat**, I want a new message from the other person to appear in the open chat without reloading, so that the conversation feels live.
- As a **logged-in user on any page**, I want my notification badge to update when I get a new chat message, so that I don't miss it.
- As a **user who leaves a tab open for hours**, I want live updates to keep working after network hiccups, idle timeouts or backend restarts, without reloading.
- As a **maintainer**, I want the websocket to stop flooding Sentry and to be covered by tests, so that it doesn't silently break again.
- As a **chat participant**, I want only members of a chat to be able to post into it, regardless of whether the message is sent over the socket or the REST API.

---

## Acceptance Criteria

### A1. Backend handshake and authentication

- **AC-A1.1**: A websocket handshake to `/ws/chat/` with a valid Knox token in the `token` cookie is accepted, and the connection joins that user's personal group. Works on the production stack (gunicorn with uvicorn workers, Channels 4.x, channels-redis 4.x, Knox 6).
- **AC-A1.2**: A handshake without a `token` cookie, with an invalid or expired token, or with a token of an inactive user is closed cleanly by the server. It never produces a 500 or an unhandled exception.
- **AC-A1.3**: The token lookup doesn't block the event loop (it touches the database, so it must run in a sync-to-async context that also handles DB connection cleanup).
- **AC-A1.4**: The user set from the token is the user the consumer sees. Channels' own session/auth middleware further down the stack must not replace it with an anonymous user. Hint: Channels 4's `AuthMiddleware` only fills `scope["user"]` if absent, but its `resolve_scope` writes to `scope["user"]._wrapped`. Check the interaction with a real user object carefully; simplifying the stack (dropping session-based auth on the socket, which the frontend never uses) is an option for Archie.
- **AC-A1.5**: A handshake whose `Origin` isn't one of our frontend origins is rejected (protection against cross-site websocket hijacking: with cookie auth, any page on a same-site subdomain could otherwise open an authenticated socket). The allowed list must not drift from the backend's CORS/CSRF origins.
- **AC-A1.6**: Disconnecting a connection that was never authenticated doesn't touch a group named after a missing user id (today: `"user-None"`).
- **AC-A1.7**: Failed authentication is logged once at a sensible level without the token value. It must not create a Sentry error per anonymous connection attempt.
- **AC-A1.8**: Sentry issue CLIMATECONNECT-BACKEND-1 stops recurring after deployment.

### A2. Safe message path (see Decision D1)

- **AC-A2.1**: Whatever path a chat message takes (websocket or `POST /api/chat/<chat_uuid>/send_message/`), the same rules apply: sender is an active participant of the chat, sender's profile isn't restricted, first-message minimum word count, origin validation. A message for an unknown chat or by a non-participant is rejected without side effects.
- **AC-A2.2**: A malformed websocket payload (not JSON, missing fields) doesn't crash the consumer or the connection and creates nothing.
- **AC-A2.3**: When a message is stored, every other active participant who has an open socket receives a live event, **regardless of the path the sender used**. Today the REST path sends no live event, so B's live update would depend on whether A's socket happened to be connected.
- **AC-A2.4**: The sender gets the outcome they get today on the REST path (success, or the existing error messages such as the restricted-profile and first-message texts). An unconfirmed message must not silently stay in the sender's thread if it was rejected.
- **AC-A2.5**: Live event payloads contain only identifiers and the event type, as today (`chat_uuid`, `message_id`, type); the client fetches content via the authenticated REST API. Hint: today the `chat_message` event also carries the message text; dropping it is preferred.

### A3. Frontend reconnect

- **AC-A3.1**: When the socket closes while the user is logged in, the frontend opens a **new** socket. Retries use increasing delays with a cap (no tight 1-second loop against a down backend) and reset after a successful connection.
- **AC-A3.2**: No socket is opened and no reconnect is attempted when the user isn't logged in, after logout, or when `SOCKET_URL` isn't configured. Logout closes the socket.
- **AC-A3.3**: The socket and pending reconnect timers are cleaned up on unmount; at most one socket per tab exists at any time.
- **AC-A3.4**: Message handlers registered by pages and components (`_app` notification refresh, `pages/chat/[chatUUID].tsx`, `ChatDrawer`) keep working after a reconnect and don't overwrite each other. Today the chat page replaces `onmessage` without chaining, so `_app`'s notification refresh stops while a chat page is open.
- **AC-A3.5**: After a reconnect, the client catches up on what it missed while disconnected (at least: refresh notifications; an open chat refreshes its messages), because the server doesn't buffer events for disconnected clients.
- **AC-A3.6**: The connection-state updates don't cause unrelated components to remount (issue #710 / PR #709 regression: FAQ elements closing). Verify on the FAQ page.
- **AC-A3.7**: Sending a message while disconnected still works via REST (existing fallback), consistent with D1.

### B. Websocket host (depends on Decision D2)

- **AC-B1**: In production, the browser sends the `token` cookie with the websocket handshake. Verified in a real browser on `climatehub.org` (DevTools: handshake request carries the cookie, response 101).
- **AC-B2**: `SOCKET_URL` (and `API_URL`, if D3 says so) in the GitHub secrets used by both frontend build workflows point at the decided host. The stale Azure app setting `SOCKET_URL` on the frontend App Service (`wss://climateconnect-backend.azurewebsites.net`, host doesn't resolve) is removed or corrected, and its non-use is documented.
- **AC-B3**: If `API_URL` changes: backend `ALLOWED_HOSTS` includes the new host, CORS and CSRF trusted origins still cover all frontend origins, the iCal feed rewrites in `next.config.js` (which use `API_URL`) still work, and server-side rendering requests from the frontend reach the backend. The old API host keeps working for a transition period (cached pages, old bundles in open tabs).
- **AC-B4**: Users on frontend hosts other than `climatehub.org` / `www.climatehub.org` are considered (see Open Question Q3).

### C. Production verification

- **AC-C1**: Acceptance scenario: user A sends a chat message to user B (once via the chat page, once via the chat drawer); B's open page (chat page and an unrelated page) shows the message / badge update without reload, within a few seconds.
- **AC-C2**: A connection survives an idle period of at least 30 minutes, or reconnects transparently; after a backend restart or slot swap, clients reconnect and live updates resume.
- **AC-C3**: Delivery works across gunicorn workers (A connected to worker 1, B to worker 2) via the Redis channel layer in production.
- **AC-C4**: No new Sentry errors from the websocket path for a week after go-live.

---

## Constraints

- **A2 must not ship after A1.** Fixing the handshake makes the socket send path reachable; without A2 any logged-in user who knows a `chat_uuid` could post into a chat they aren't part of, bypassing the restricted-profile and first-message rules.
- The token is never logged, never sent to Sentry, and never put into a URL unless Decision D4 explicitly accepts that.
- No change to how REST authenticates (`Authorization: Token …` header).
- Backwards compatible during deployment: old frontend bundles in open tabs must not break the new backend, and vice versa (slot swap).
- `RUN_CELERY` / slot topology (#2352) unchanged. slot2 shares the production DB and Redis, so live events sent while testing on slot2 reach real users' sockets on the production slot (same groups on the same Redis). Test with test accounts only.
- The container migration itself and the dependency update PR #2410 are not part of this task.

---

## AI Agent Insights and Additions

### Evidence from the investigation (2026-11-24, verified)

**Problem 1: middleware**
- `TokenAuthMiddleware` in `backend/climateconnect_main/token_auth.py` has the Channels 2 shape: `__init__(inner)` plus a sync `__call__(self, scope)` returning `self.inner(scope)`. Channels 3+ calls middleware as an ASGI3 application `(scope, receive, send)`. Installed: channels 4.3.2, channels-redis 4.3.0, daphne; `backend/pyproject.toml` pins only `channels>=4.0.0`.
- Error: `TypeError: TokenAuthMiddleware.__call__() takes 2 positional arguments but 4 were given`, culprit `channels.sessions in __call__` (the outer `CookieMiddleware` calls our middleware).
- Sentry CLIMATECONNECT-BACKEND-1 (https://climate-connect-ggmbh.sentry.io/issues/CLIMATECONNECT-BACKEND-1): 18,222 events, first seen 2026-09-22 (probably when that Sentry project was set up; the bug is older), last seen 2026-11-24.
- Reproduced locally with the production start command shape (gunicorn + `uvicorn.workers.UvicornWorker`) and a Python `websockets` client sending `Cookie: token=<knox token>`: handshake returns 500.
- Stack today: `CookieMiddleware(TokenAuthMiddleware(AuthMiddlewareStack(URLRouter(...))))`. `AuthMiddlewareStack` adds `CookieMiddleware` + `SessionMiddleware` + `AuthMiddleware` again. Routing: `backend/climateconnect_main/routing.py`; ASGI entry `climateconnect_main/asgi.py` uses `get_default_application()`; `ASGI_APPLICATION = "climateconnect_main.routing.application"`. No origin validation in the stack.
- The knox lookup used is `TokenAuthentication().authenticate_credentials(token_bytes)`. It's a sync DB call. With Knox 6 (PR #2410) REST token auth was verified and existing logins survived.

**Problem 2: cookie domain vs. websocket host**
- Live production bundle on climatehub.org: `SOCKET_URL = "wss://api.climateconnect.earth"`, `API_URL = "https://api.climateconnect.earth"`.
- `frontend/public/lib/cookieOperations.ts` (~line 39) sets the `token` cookie with `domain = "." + BASE_URL_HOST` in production (→ `.climatehub.org`), `sameSite: "lax"`, `secure`. In staging and development no domain is set (host-only cookie).
- Browsers send that cookie only to `*.climatehub.org`. REST works because it uses the `Authorization` header; browsers can't set custom headers on a WebSocket, so the socket relies on the cookie alone.
- The backend App Service `climate-backend-appservice` (RG `climate-connect-backend`) already has hostnames `api.climatehub.org` and `api.climateconnect.earth`. `https://api.climatehub.org/api/hubs/` returns 200. `CSRF_TRUSTED_ORIGINS` already lists both API hosts (harmless; CSRF origins are about the requesting page, not the target).
- `climatehub.org` → `api.climatehub.org` is same-site, so a `Lax` cookie with domain `.climatehub.org` is sent on the handshake.
- `SOCKET_URL`, `API_URL`, `BASE_URL_HOST` are GitHub secrets baked into the bundle at build time (both frontend workflows, `next.config.js` `env` list). The Azure app setting `SOCKET_URL` on the frontend App Service is stale (`wss://climateconnect-backend.azurewebsites.net`, doesn't resolve) and unused.
- Domains (checked 2026-11-24): `https://climateconnect.earth/` → 308 to `https://climatehub.org/`; `https://potsdam.climateconnect.earth/` → 307 to `https://climatehub.org/hubs/potsdam…`; **`https://www.climateconnect.earth/` serves the app directly (200, Next.js)**. On that host the production cookie domain `.climatehub.org` doesn't match, so the browser would reject the cookie; login there is probably already broken, independent of this task (Q3).
- Staging/dev: with a host-only cookie, the socket only authenticates if frontend and backend share the host (localhost works; cookies ignore ports). On Azure staging with different `*.azurewebsites.net` hosts it won't authenticate. That's acceptable if documented, or a reason to revisit D4.

**Problem 3: reconnect**
- `_app.tsx` `connect(initialClient)`: `onclose` schedules `connect(client)` with the same closed socket after 1 s. Because `initialClient` is truthy, no new socket is created; only handlers are reassigned. One disconnect ends live updates for the tab's lifetime.
- `onclose` reads `socketConnectionState` from a stale closure, and nothing closes the socket on logout or unmount.

### Additional findings (found while writing this spec, verified in code)

- **I1: Socket send path lacks authorization (security).** `DirectMessageConsumer.receive` → `new_message` stores a message for any `chat_uuid` given by any authenticated user. Compared to `SendChatMessage` (REST), it doesn't check that the sender is an active participant, doesn't check `restricted_profile`, doesn't enforce the first-message word minimum, and crashes on an unknown `chat_uuid` (`chat` is `None`, then `chat.last_message_at`). It also doesn't handle malformed JSON. Today this is unreachable (problem 1). → AC-A2.1/A2.2, Constraint 1.
- **I2: The frontend sends chat messages over the socket when connected.** `ChatDrawer.tsx` and `pages/chat/[chatUUID].tsx` use `chatSocket.send(...)` if `socketConnectionState === "connected"`, else REST. Once A1 + B ship, most messages would go through the socket path (I1). The chat page's socket send also omits the message origin fields that the drawer sends.
- **I3: REST send doesn't push a live event.** `SendChatMessage` stores the message and creates notifications but doesn't call the channel layer. Only the socket path does `group_send`. → AC-A2.3.
- **I4: Live notifications for non-chat events are disabled.** `send_out_live_notification` (`climateconnect_api/utility/notification.py`) exists, but every call is commented out (`climateconnect_api`, `organization`, `ideas` notification utilities). So today the socket can only ever carry chat events. Re-enabling them is **out of scope** unless Harald decides otherwise (Q4); the consumer's `notification` handler stays.
- **I5: Handlers overwrite each other.** `pages/chat/[chatUUID].tsx` sets `chatSocket.onmessage` without chaining (`_app`'s notification refresh is lost on that page); `ChatDrawer` chains and restores. Both attach to the socket object, so a new socket on reconnect loses them unless the design changes. → AC-A3.4.
- **I6: The chat event carries message content** through Redis (`message` field). The clients don't use it; they re-fetch by `message_id`. → AC-A2.5.
- **I7: Docs are wrong.** `doc/architecture.md` (Token Flow, step 5) says websockets authenticate "via token in connection params"; it's the cookie. `doc/environment-variables.md` gives `wss://climateconnect.earth` / `wss://api.climateconnect.earth` as production `SOCKET_URL` and `api.climateconnect.earth` as production API host.

### Alternatives for socket authentication (input for D4)

| Option | Pros | Cons |
|---|---|---|
| **Cookie, socket host same-site with frontend** (preferred) | No token in URLs; no frontend auth code; existing cookie | Needs backend host under the frontend's registrable domain; doesn't work on staging with different hosts; needs Origin check (AC-A1.5) |
| Token in query string | Domain-independent | Token appears in access logs, Azure/App Gateway logs, Sentry breadcrumbs/transactions; long-lived Knox tokens make that a real leak |
| Token in `Sec-WebSocket-Protocol` | Domain-independent; not in URL | Non-standard use of the header; may show up in proxy logs; server must echo a protocol; more custom code |
| Short-lived ticket (REST call issues a one-time socket ticket, passed in the URL) | Domain-independent; leaked ticket is useless after seconds | New endpoint and storage (Redis), more moving parts |

Recommendation: cookie approach if D2 aligns the domains; the one-time ticket is the cleanest fallback if it doesn't.

### Hosting notes (not yet verified, Part C)

- The backend App Service reports `webSocketsEnabled: false`. On Linux App Service, handshakes demonstrably reach the ASGI app (the Sentry errors are raised inside our app), but long-lived connections and idle timeouts are untested. The container App Service (`climate-backend-container`) needs the same check.
- Production `CHANNEL_LAYERS` (`settings.py` ~line 414) uses `channels_redis.core.RedisChannelLayer` with `REDIS_HOST`/`REDIS_PORT`/`REDIS_PASSWORD`, `ssl: True`; dev override ~line 697. Celery uses the same Redis, so connectivity likely works, but `group_send` has never run in production.
- Production start: `backend/start_backend.sh`, gunicorn with `uvicorn.workers.UvicornWorker`, 4 workers; container: `docker/backend-entrypoint.sh`. Cross-worker delivery relies on the Redis layer.
- Azure's front end drops idle websocket connections after a few minutes. An application-level keepalive (server or client ping) may be needed in addition to reconnect; Archie to decide.

---

## Tests

Backend (Channels test tooling, e.g. `WebsocketCommunicator`; Redis-free channel layer in tests unless Archie decides otherwise):
- T-A1: valid token cookie → connected, joined `user-<id>`; a `group_send` to that group reaches the socket.
- T-A2: no cookie / invalid token / inactive user → closed, no exception, no group named `user-None`.
- T-A3: disallowed `Origin` → rejected (AC-A1.5).
- T-A4: the user in the consumer scope is the token's user (AC-A1.4), not anonymous.
- T-A5: socket send by a non-participant, by a restricted profile, below the first-message minimum, for an unknown chat, with malformed JSON → nothing stored, no notification, connection stays usable.
- T-A6: REST send → other participants' sockets receive the live event; the sender's own socket behaviour as decided in D1.
- T-A7: live event payload contains no message text (if AC-A2.5 is accepted).
- Full backend suite passes (`pdm run python manage.py test --keepdb`).

Frontend (Jest):
- T-F1: on close while logged in, a new socket is created, with growing delays; no reconnect after logout; cleanup on unmount.
- T-F2: handlers from chat page and drawer still fire after a reconnect; `_app` notification refresh still fires on the chat page.
- T-F3: after reconnect, notifications are refreshed (AC-A3.5).

Manual / integration:
- Local: backend like production (`pdm run gunicorn --bind=127.0.0.1:8000 climateconnect_main.asgi:application -w 2 -k uvicorn.workers.UvicornWorker`), Redis channel layer, local Next.js with `SOCKET_URL=ws://127.0.0.1:8000`; two browsers, users A and B, AC-C1. With 2 workers, also covers AC-C3. Kill and restart gunicorn for AC-C2.
- slot2: backend slot without Celery, shares prod DB and Redis, no frontend. A local Next.js pointed at slot2 is possible; CORS for `http://localhost:3000` is already allowed, but the cookie domain/host issue applies (cookie set for `localhost` won't reach the slot2 host). Test accounts only (see Constraints).
- Production: AC-C1–C4 after go-live.

---

## Documentation

- `doc/architecture.md`: correct the websocket auth description (I7); describe the socket's role (push-only or bidirectional per D1), the auth mechanism, Origin check and reconnect behaviour.
- `doc/api-documentation.md`: document `/ws/chat/` (auth, event types and payloads, close behaviour) and the change to `send_message` (live event).
- `doc/environment-variables.md`: correct production values for `SOCKET_URL` / `API_URL`; state that they are build-time values from GitHub secrets and that the Azure app setting is not used; note the staging limitation.
- `doc/mosy/flows/`: update the chat flow if it describes the socket.
- `doc/spec/20260826_1138_container_based_deployment_pipeline.md`: cross-reference D2 if the API host switch is bundled with the container cutover.

---

## Definition of Done

- [ ] A1, A2, A3 merged; tests T-A1–T-A7 and T-F1–T-F3 pass; full backend and frontend suites pass; `make format`, `yarn lint`, `yarn format` run.
- [ ] D2 decided; Part B done (secrets, Azure setting cleanup, backend hosts if `API_URL` changes).
- [ ] Part C verified in production (AC-C1–C4); Sentry CLIMATECONNECT-BACKEND-1 resolved.
- [ ] Documentation updated (section above).
- [ ] Code review done.

---

## Out of Scope

- The dependency update PR #2410 and the container migration itself (only the domain decision is coordinated).
- Re-enabling live notifications for non-chat events (I4), unless Harald decides otherwise (Q4).
- Login on `www.climateconnect.earth` (Q3), beyond documenting it.
- Typing indicators, read receipts, presence or other new realtime features.
- Making the `token` cookie `httpOnly` (existing TODO in `cookieOperations.ts`); worth a separate task since the socket would keep working with it.

---

## Decisions (to be made by Harald, with Archie's input)

- **D1: Role of the socket.** (a) Push-only: clients send messages only via REST; REST pushes the live event; the consumer ignores or rejects incoming messages. One code path for validation. (b) Bidirectional: keep socket send, but it must share the REST path's validation and error reporting. Recommendation: (a). Simpler, one place for the rules, and errors (411 first-message, 403 restricted) already have UI handling on the REST path.
- **D2: Websocket host / domain strategy.** Point `SOCKET_URL` at `wss://api.climatehub.org`. Harald's direction: make `api.climatehub.org` the official backend host as part of the backend move to the container deployment, so that switching between the App Service and the container backend needs no DNS change on the frontend side. Options: (a) switch `SOCKET_URL` now (the App Service already serves `api.climatehub.org`) and repoint the hostname at cutover; (b) wait and switch together with the container cutover. Either way the hostname must be bound (with TLS) to whichever backend serves production.
- **D3: Move `API_URL` too?** For consistency, `API_URL` → `https://api.climatehub.org` at the same time as `SOCKET_URL`. Needs AC-B3 (ALLOWED_HOSTS, rewrites, SSR, transition period for `api.climateconnect.earth`). Not strictly needed for the socket.
- **D4: Auth mechanism.** Cookie (preferred, requires D2) vs. one-time ticket vs. query/subprotocol token (see table). Also decides whether staging can test the socket.

## Open Questions

- **Q1**: Does the Linux App Service (and the container App Service) keep websocket connections open long enough, and does `webSocketsEnabled: false` matter on Linux? What is the actual idle timeout? (Part C)
- **Q2**: Does the production Redis channel layer work as configured (`ssl: True`, password, port) from the backend App Service and the container? (Part C)
- **Q3**: `www.climateconnect.earth` serves the app without redirecting to `climatehub.org`. Is that intended? If yes, login there can't set the `.climatehub.org` cookie, and the socket won't authenticate there either. Should it redirect like the apex domain?
- **Q4**: Should the commented-out `send_out_live_notification` calls (comments, follows, ideas) be re-enabled once the socket works? Why were they disabled (commits around #1452 / #1479)?
- **Q5**: Should the sender's own other tabs receive the live event for their own message (today the socket path sends to all participants including the sender, which confirms the "unconfirmed" message)? Depends on D1.
- **Q6**: Should staging have a working socket (affects D4), or is local + slot2 testing enough?

---

## System impact

*Pending: to be filled in by Archie.*

---

## Log

- 2026-11-24 12:32 UTC: Created by Taskie from Harald's investigation of 2026-11-24 (Sentry CLIMATECONNECT-BACKEND-1, local reproduction with gunicorn + uvicorn, production bundle and domain checks, Azure hostnames). Code read on `master` 353544fb4. Added findings I1–I7 (most important: the socket send path bypasses chat authorization, I1; REST send doesn't push live events, I3; `www.climateconnect.earth` serves the app without redirect). Decisions D1–D4 and open questions Q1–Q6 await Harald's review. System impact pending Archie. Status: DRAFT.
