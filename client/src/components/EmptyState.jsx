import { greeting } from '../hooks/useEasterEggs';

const SUGGESTIONS = {
  professional: [
    { title: 'Draft a status update', prompt: 'Draft a concise weekly status update for a software project that shipped a streaming chat feature and is planning MongoDB persistence next.' },
    { title: 'Explain a concept', prompt: 'Explain how Server-Sent Events differ from WebSockets and when to choose each.' },
    { title: 'Review an approach', prompt: 'What are the trade-offs of embedding chat messages inside a conversation document in MongoDB versus a separate collection?' },
  ],
  casual: [
    { title: 'Weekend plan', prompt: 'Give me a fun, low-effort plan for a rainy Sunday.' },
    { title: 'Explain like a friend', prompt: 'Explain how JavaScript promises work like you are chatting with a friend over coffee.' },
    { title: 'Random idea', prompt: 'Pitch me a silly startup idea and why it might actually work.' },
  ],
  concise: [
    { title: 'Quick definition', prompt: 'What is idempotency in APIs?' },
    { title: 'Fast comparison', prompt: 'React vs Vue in three bullet points.' },
    { title: 'One-liner', prompt: 'Give me a one-line Python snippet to reverse a string.' },
  ],
};

export const EmptyState = ({ tone = 'professional', onPick }) => (
  <div className="empty">
    <div className="empty__logo"><span><i /><i /><i /></span></div>
    <h1>{greeting()} — what's the <em>vibe</em>?</h1>
    <p>Pick a tone above, then ask anything. Responses stream live and every thread is saved to your history.</p>
    <div className="suggestions">
      {(SUGGESTIONS[tone] ?? SUGGESTIONS.professional).map((s) => (
        <button key={s.title} className="suggestion" onClick={() => onPick(s.prompt)}>
          <strong>{s.title}</strong>
          <span>{s.prompt}</span>
        </button>
      ))}
    </div>
  </div>
);
