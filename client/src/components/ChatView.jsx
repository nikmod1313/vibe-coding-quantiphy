import { useEffect, useRef } from 'react';
import { MessageBubble } from './MessageBubble';
import { EmptyState } from './EmptyState';

export const ChatView = ({ messages, draft, status, error, tone, tones, onPickSuggestion, onRegenerate, onDismissError }) => {
  const endRef = useRef(null);
  const toneLabel = (id) => tones.find((t) => t.id === id)?.label;

  // Follow the stream.
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length, draft?.content, status]);

  if (!messages.length && !draft) return <EmptyState tone={tone} onPick={onPickSuggestion} />;

  return (
    <div className="chat">
      <div className="chat__inner">
        {messages.map((m, i) => {
          // Regenerate is offered on the latest assistant message only.
          const isLastAssistant = m.role === 'assistant' && i === messages.length - 1 && status === 'idle';
          return (
            <MessageBubble
              key={m._id ?? i}
              message={m}
              tones={tones}
              toneLabel={toneLabel}
              onRegenerate={isLastAssistant ? onRegenerate : undefined}
            />
          );
        })}
        {status === 'loading' && !draft && (
          <MessageBubble message={{ role: 'assistant', content: '', tone }} streaming toneLabel={toneLabel} />
        )}
        {draft && <MessageBubble message={draft} streaming toneLabel={toneLabel} />}
        {error && (
          <div className="msg msg--assistant">
            <div className="msg__avatar">!</div>
            <div className="msg__body">
              <div className="bubble bubble--error">{error}</div>
              <div className="msg__meta"><button className="chip" onClick={onDismissError}>dismiss</button></div>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>
    </div>
  );
};
