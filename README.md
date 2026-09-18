# VibeChat — AI Chat Assistant

Real-time streaming chat assistant with a **Tone Toggle** (Professional / Casual / Concise), conversation history and MongoDB persistence.

Built for the NMIMS Vibe Coding Round.

## Stack
- **Server:** Node.js, Express, Mongoose (MongoDB), Anthropic Claude API (OpenAI adapter available), Server-Sent Events for streaming
- **Client:** React 19 + Vite, plain CSS design system

## Quick start
```bash
npm install
cp server/.env.example server/.env   # add your ANTHROPIC_API_KEY
npm run dev                          # server :3001, client :5173
```
