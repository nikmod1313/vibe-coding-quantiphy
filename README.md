# VibeChat — AI Chat Assistant with Tone Control

A real-time AI chat assistant: streaming responses, persistent conversation history, and a **Tone Toggle** (Professional / Casual / Concise) that the **server** turns into a system-instruction modifier on every model call.

Built for the NMIMS Vibe Coding Round · Problem: *AI Chat Assistant*.

---

## Features

| Requirement | Implementation |
|---|---|
| Chat interface with distinct bubbles | React chat view, user/assistant bubbles, Markdown + syntax-aware code blocks with copy |
| Streaming view | **True token streaming** from the model over Server-Sent Events (not a fake typing timer) + blinking cursor + Stop generating |
| History sidebar | Threads with auto-generated titles, tone indicator, last-message preview, rename/delete, **search** |
| API integration | Provider adapter pattern — **Gemini (active)**, Claude and OpenAI adapters, switched by one env var |
| MongoDB persistence | `Conversation` documents embed messages with timestamps, prompt, response, tone and generation metadata |
| **Tone Toggle** | Tone id sent to server → server composes `base persona + tone instruction` as the system prompt → style changes instantly, mid-thread |

Extras that go beyond the brief:

- **Per-message tone badges** — every reply records which tone produced it; **Regenerate as ▸ Professional / Casual / Concise** on the latest reply to compare styles side by side.
- **Metadata chips** — latency, output tokens, model, stopped-early flag, persisted per message.
- **Auto-titling** — after the first exchange the server names the thread.
- **Edit & resend** — rewrite any earlier prompt; the server truncates the thread from that point and re-runs it.
- **Export** — download any thread as a Markdown transcript (rendered server-side, metadata included).
- **Context-window management** — history is trimmed to a token budget (newest first, latest prompt always kept, never starting on an assistant turn); each reply records how many turns were sent and how many were trimmed (`ctx` chip).
- **Private by default** — a signed anonymous session cookie scopes every thread to the browser that created it; no login needed, no cross-visitor leakage.
- **Resilience** — transient provider errors (429/5xx) are retried with backoff *before* any token is streamed; friendly error bubble with Retry; partial replies are kept when the user stops generation.
- **Reader-friendly scrolling** — auto-follow pauses when you scroll up; a "Latest" pill jumps back.
- **Keyboard-first** — `Enter` send, `Shift+Enter` newline, `⌘K` new chat, `Esc` stop.
- **Live health** — sidebar footer shows provider, model and DB status from `/api/health`.

---

## Architecture

```
┌──────────────────────────┐        HTTP / SSE        ┌──────────────────────────────────────────┐
│  client (React + Vite)   │ ───────────────────────▶ │  server (Express)                        │
│                          │                          │                                          │
│  api/client.js  ─ fetch + SSE parser                │  routes/        HTTP only (validate, SSE)│
│  hooks/useChat  ─ streaming state machine           │  services/chat  business logic           │
│  hooks/useConversations                             │  services/tone  tone presets (the vibe)  │
│  components/    ─ presentation only                 │  services/prompt system-prompt composer  │
│                          │                          │  services/title auto-titling             │
│  no business logic,      │                          │  services/ai/   provider adapters        │
│  no prompt text,         │                          │     gemini | anthropic | openai          │
│  no API keys             │                          │  models/        Mongoose schemas         │
└──────────────────────────┘                          └───────────┬──────────────────────────────┘
                                                                  │ Mongoose
                                                                  ▼
                                                            MongoDB (vibe-chat)
```

**Layering on the server** (`server/src`):

- `routes/` — translate HTTP ⇄ service calls. Zod validation on every body/param/query. The chat route only turns service events into SSE frames.
- `services/chat.js` — the core use-case: persist user turn → build bounded history → compose system prompt → stream → persist assistant turn with metadata → auto-title.
- `services/context.js` — token-budgeted history selection (see *Design decisions*).
- `services/tone.js` — the three presets and their system-instruction text. **The client only ever sends a tone id**; all prompt engineering lives here.
- `services/ai/` — one contract (`stream()` async generator + `complete()`), three adapters. Swapping providers is a config change, not a code change.
- `models/Conversation.js` — conversation with embedded messages (one document per thread → a single read renders a whole chat; `listSummaries()` aggregation projects only what the sidebar needs).
- `middleware/` — zod validation, typed `HttpError`, central error handler.

### Streaming protocol

`POST /api/conversations/:id/messages` returns `text/event-stream`:

| event | payload | meaning |
|---|---|---|
| `user_message` | persisted user message | stored before generation starts |
| `start` | `{ tone, provider, model }` | generation begins with this tone |
| `retry` | `{ attempt, status }` | provider hiccup, retrying |
| `truncated` | `{ fromMessageId }` | edit & resend dropped this message and everything after it |
| `token` | `{ text }` | a streamed delta |
| `done` | `{ stopped, message }` | persisted assistant message with metadata |
| `title` | `{ title }` | thread was auto-named |
| `error` | `{ status, message }` | friendly failure |

Closing the connection (Stop button / tab close) aborts the upstream model request via `AbortController`; whatever was generated is still saved and flagged `stopped`.

### The Tone Toggle, end to end

1. User picks a tone → `PATCH /api/conversations/:id { tone }` (or sends it with the next message / regenerate).
2. `services/prompt.js` builds `BASE_SYSTEM_PROMPT + "## Response style: <Tone>" + tone.instruction`.
3. The adapter passes it as the provider's system instruction (`systemInstruction` for Gemini, `system` for Claude, a `system` message for OpenAI).
4. The reply is stored with `tone`, so the UI can badge it and the thread can mix tones.

---

## Security

- **API keys never leave the server.** Read once in `config/env.js`, handed only to the provider SDK; never logged, never in any response (tested), never in the client bundle (Vite only exposes `VITE_*`).
- `.env` is git-ignored; a **pre-commit hook** (`.githooks/pre-commit`) blocks commits containing key-shaped strings or `.env` files. Enable with `git config core.hooksPath .githooks`.
- Server boots only if the active provider's key is present (fail fast, clear message).
- **Session isolation**: `middleware/session.js` issues an HMAC-signed, HttpOnly, SameSite=Lax cookie (Secure in production). Every conversation carries the `sessionId`; every list/read/update/delete/export/generate query is filtered by it and returns 404 for anything else — existence is never revealed. Forged signatures are rejected with a timing-safe compare. `SESSION_SECRET` is required in production.
- **Input validation everywhere** with zod: strings only (NoSQL operator objects are rejected), length caps, enum-checked tones, ObjectId-checked ids.
- **Search is injection-safe**: query is regex-escaped and capped at 100 chars before touching MongoDB.
- **No XSS**: `react-markdown` renders Markdown to React elements and never injects raw HTML.
- `helmet` security headers, `x-powered-by` off, strict 256 kb JSON bodies, CORS locked to the client origin.
- **Rate limiting**: 300 req/min per IP on the API, 30 generations/min (generation costs money).
- No admin/debug endpoints; `/api/health` returns only provider name, model, DB state and uptime.

---

## Running locally

Prerequisites: Node 20+, MongoDB running locally (or an Atlas URI), a Gemini API key (or Anthropic / OpenAI).

```bash
npm install
cp server/.env.example server/.env    # put your key in GEMINI_API_KEY (SESSION_SECRET optional locally)
npm run dev                            # server → http://localhost:3001, client → http://localhost:5173
```

Switch providers by editing `server/.env`:

```
AI_PROVIDER=gemini        # gemini | anthropic | openai
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-3.6-flash
```

Tests (no DB or key required — DB and provider are mocked):

```bash
npm test
```

---

## API reference

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | provider, model, DB status |
| GET | `/api/tones` | tone presets for the toggle (ids + labels only) |
| GET | `/api/conversations?q=` | sidebar list, optional search |
| POST | `/api/conversations` | create thread `{ tone? }` |
| GET | `/api/conversations/:id` | full thread |
| PATCH | `/api/conversations/:id` | `{ title? , tone? }` |
| DELETE | `/api/conversations/:id` | delete thread |
| GET | `/api/conversations/:id/export` | Markdown transcript download |
| POST | `/api/conversations/:id/messages` | `{ content, tone? }`, `{ regenerate: true, tone? }`, or `{ content, editMessageId }` → SSE |

All routes are scoped to the caller's session cookie.

---

## Project structure

```
.
├── client/                 React 19 + Vite
│   └── src/
│       ├── api/            fetch + SSE client
│       ├── hooks/          useChat, useConversations
│       ├── components/     Sidebar, ChatView, MessageBubble, Composer, ToneToggle, Markdown, EmptyState
│       └── styles/         design tokens + app styles
├── server/                 Express (ESM)
│   ├── src/
│   │   ├── config/         env (validated), db
│   │   ├── middleware/     session (signed cookie), validate (zod), errorHandler
│   │   ├── models/         Conversation
│   │   ├── routes/         conversations, chat (SSE)
│   │   └── services/       chat, tone, prompt, context, title, export, ai/{gemini,anthropic,openai}
│   ├── test/               node:test suites
│   └── .env.example
├── .githooks/pre-commit    secret-leak guard
└── package.json            npm workspaces, `npm run dev`, `npm test`
```

## Design decisions (and the trade-offs)

- **SSE over WebSockets** — the stream is one-directional (server → client) and fits plain HTTP, proxies and `fetch`; WebSockets would add a second protocol for no gain.
- **Embedded messages vs. separate collection** — one read per thread, atomic writes, and the sidebar uses an aggregation projection so it never loads message bodies. A separate collection would only pay off for very long threads or cross-thread analytics.
- **Tone as data, not code paths** — adding a fourth tone is one object in `tone.js`; the UI, validation and badges pick it up automatically.
- **Token budget instead of "last N messages"** — a fixed N either overflows the context on long messages or wastes it on short ones. Estimating ~4 chars/token is provider-agnostic and good enough to stay safely inside limits; a rolling summary of dropped turns is the natural next step and slots into `services/context.js` without touching the chat flow.
- **Anonymous sessions instead of accounts** — the brief has no auth requirement, but unscoped threads are a real privacy bug. A signed cookie gives isolation now and a single swap-point (`req.sessionId`) for real users later.
- **Edit = truncate + resend, not a branch tree** — full branching (assistant-ui style) needs parent pointers and a branch picker; truncation gives 90 % of the value with zero schema complexity.
- **Provider adapters** — the chat service never imports a vendor SDK; the contract is a tiny async-generator, which keeps vendor churn (like a model being retired) a one-file fix.
