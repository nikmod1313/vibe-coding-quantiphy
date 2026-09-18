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
- **Daily summary** — one click turns your recent chats into flip-flashcards: topic → takeaway → a *new* insight the chat didn't cover → a self-test question, each linked back to its thread. One model call per day per session, cached.
- **Auto-titling** — after the first exchange the server names the thread.
- **Edit & resend** — rewrite any earlier prompt; the server truncates the thread from that point and re-runs it.
- **Export** — download any thread as a Markdown transcript (rendered server-side, metadata included).
- **Context-window management** — history is trimmed to a token budget (newest first, latest prompt always kept, never starting on an assistant turn); each reply records how many turns were sent and how many were trimmed (`ctx` chip).
- **Private by default** — a signed anonymous session cookie scopes every thread to the browser that created it; no login needed, no cross-visitor leakage.
- **Resilience** — transient provider errors (429/5xx) are retried with backoff *before* any token is streamed; friendly error bubble with Retry; partial replies are kept when the user stops generation.
- **Quota-aware model fallback** — Gemini free tier is 20 requests/day *per model*; when the primary model's daily quota is exhausted the adapter moves to the next model in `GEMINI_FALLBACK_MODELS` and marks the exhausted one (visible in `/api/health`). Daily-quota errors are never retried (retrying only burns quota). Titles are heuristic by default so a thread costs exactly one request.
- **Reader-friendly scrolling** — auto-follow pauses when you scroll up; a "Latest" pill jumps back.
- **Keyboard-first** — `Enter` send, `Shift+Enter` newline, `⌘K` new chat, `Esc` stop.
- **Live health** — sidebar footer shows provider, model and DB status from `/api/health`.

---

## Architecture

```mermaid
flowchart LR
    subgraph Browser["Browser · React + Vite (presentation only)"]
        UI[Components<br/>Sidebar · ChatView · Composer · ToneToggle · InsightsPanel]
        Hooks[Hooks<br/>useChat · useConversations]
        API[api/client.js<br/>fetch + SSE parser]
        UI --> Hooks --> API
    end

    subgraph Server["Server · Express (all business logic)"]
        direction TB
        MW[Middleware<br/>helmet · rate limit · session cookie · zod validation]
        Routes[Routes<br/>conversations · chat (SSE) · insights]
        Chat[services/chat<br/>persist → context → prompt → stream → persist]
        Tone[services/tone + prompt<br/>tone presets → system instruction]
        Ctx[services/context<br/>token-budgeted history]
        Title[services/title · export · insights]
        Adapter[services/ai<br/>provider contract]
        MW --> Routes --> Chat
        Chat --> Tone
        Chat --> Ctx
        Routes --> Title
        Chat --> Adapter
        Title --> Adapter
    end

    subgraph Providers["LLM providers (swap by env)"]
        G[Gemini<br/>+ quota fallback chain]
        A[Claude]
        O[OpenAI]
    end

    DB[(MongoDB<br/>Conversation { sessionId, tone, messages[] })]

    API -- "REST + text/event-stream" --> MW
    Adapter --> G
    Adapter -.-> A
    Adapter -.-> O
    Chat --> DB
    Routes --> DB
```

**Request flow for one chat turn**

```mermaid
sequenceDiagram
    participant U as Browser
    participant R as chat route (SSE)
    participant S as services/chat
    participant P as provider adapter
    participant M as MongoDB
    U->>R: POST /conversations/:id/messages { content, tone? }
    R->>S: sendMessage(sessionId, …)
    S->>M: push user turn (survives a failed generation)
    S-->>U: event: user_message
    S->>S: selectContext (token budget) + buildSystemPrompt(tone)
    S-->>U: event: start { tone, model, context }
    S->>P: stream(system, history, abortSignal)
    loop tokens
        P-->>S: delta
        S-->>U: event: token
    end
    S->>M: push assistant turn + metadata (latency, tokens, tone, ctx)
    S-->>U: event: done { message }
    S-->>U: event: title (first exchange only)
    Note over U,R: Closing the connection aborts P via AbortController; partial text is still saved and flagged "stopped".
```

### Design decisions, trade-offs, and what we learned

| Decision | Why | Trade-off accepted | Lesson |
|---|---|---|---|
| **All logic server-side; client is a renderer** | Required by the brief, and it keeps prompt text, keys and validation in one trusted place | The client needs an SSE parser instead of a plain `fetch` | A thin client is easier to test *and* to secure — there is nothing in the bundle worth protecting |
| **SSE over WebSockets** | Streaming is one-directional; SSE is plain HTTP — works through proxies, needs no extra server, and `fetch` + `AbortController` gives cancellation for free | No client→server messages mid-stream (we don't need any) | Pick the simplest transport that satisfies the data flow |
| **Tone as data (`tone.js`), not code paths** | Adding a tone is one object; validation, badges, export and insights all derive from it | Tones can't have custom logic beyond text — fine for style control | Config-driven behaviour scales better than `if (tone === …)` |
| **Tone stored per message, not just per thread** | Lets users mix tones in one thread and compare answers side by side (regenerate-as) | A few bytes per message | Recording *which* instruction produced an answer is cheap and hugely useful for debugging and demos |
| **Provider adapter with a 2-method contract** | Vendors retire models and change SDKs; the chat service never imports a vendor | Least-common-denominator features only (no vendor-specific tools) | The Gemini model retirement we hit mid-build was a one-line fix because of this |
| **Quota-aware fallback chain** | Free tiers cap requests per model per day; a demo must not die at request 21 | Different models may answer slightly differently | Design for the failure you *will* hit, not the one you might |
| **Heuristic titles by default, AI titles opt-in** | Halves request usage; the heuristic is good enough for a sidebar | Less elegant titles unless `AUTO_TITLE=ai` | Every model call must earn its cost |
| **Embedded messages in one document** | One read renders a thread; writes are atomic; sidebar uses an aggregation projection so it never loads bodies | Very long threads would bloat a document (bounded here by the context budget and UX) | Model the data around the read pattern |
| **Token-budgeted context, not "last N"** | A fixed N overflows on long messages and wastes context on short ones | ~4 chars/token is an estimate, not a tokenizer | Report what you trim (the `ctx` chip) — users and judges trust visible behaviour |
| **Anonymous signed-cookie sessions** | Unscoped threads are a privacy bug even in a demo; a signed cookie gives isolation with zero login friction | No cross-device sync until real auth exists | Put the identity behind one variable (`req.sessionId`) so upgrading to accounts is local |
| **Edit = truncate + resend, not a branch tree** | 90% of the value of branching with no schema for parents/branch pickers | Edited-away replies are gone (export first if needed) | Ship the simple version that's correct; add complexity when a real need appears |
| **Retry before first token only** | Replaying partial output would duplicate text | A mid-stream failure surfaces as an error with Retry | Idempotency boundaries matter more than retry counts |
| **Insights cached per session per day** | The digest only changes when a thread changes; repeated clicks must be free | In-memory cache resets on restart (acceptable for one-request cost) | Cache keys should encode *why* a result would change |

### What makes this implementation distinctive

1. **Tone lineage** — every reply knows which tone produced it; regenerate-as makes the "vibe check" visibly demonstrable.
2. **True streaming with cancellation and honest persistence** — stopped replies are saved and labelled, not lost.
3. **Quota-aware provider layer** — daily-quota detection, no wasteful retries, automatic model fallback, health endpoint that shows the chain.
4. **Context accountability** — the `ctx` chip shows exactly how much history the model saw.
5. **Daily summary flashcards** — the history isn't just a list; it's turned into study material with new insights.
6. **Security as a default** — session isolation, validated inputs, escaped search, secret-blocking pre-commit hook, keys that never leave the server.

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
GEMINI_FALLBACK_MODELS=gemini-3.7-flash,gemini-3.5-flash,gemini-3.1-flash-lite
AUTO_TITLE=heuristic      # or "ai" for model-generated titles (+1 request per thread)
```

> Free-tier note: each Gemini model allows ~20 requests/day. With heuristic titles a conversation turn costs one request; the fallback chain gives you 4× that headroom.

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
| GET | `/api/insights/daily?refresh=1` | flashcards from recent threads (cached per day) |
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
│       ├── components/     Sidebar, ChatView, MessageBubble, Composer, ToneToggle, Markdown, EmptyState, InsightsPanel
│       └── styles/         design tokens + app styles
├── server/                 Express (ESM)
│   ├── src/
│   │   ├── config/         env (validated), db
│   │   ├── middleware/     session (signed cookie), validate (zod), errorHandler
│   │   ├── models/         Conversation
│   │   ├── routes/         conversations, chat (SSE), insights
│   │   └── services/       chat, tone, prompt, context, title, export, insights, ai/{gemini,anthropic,openai}
│   ├── test/               node:test suites
│   └── .env.example
├── .githooks/pre-commit    secret-leak guard
└── package.json            npm workspaces, `npm run dev`, `npm test`
```
