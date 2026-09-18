import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowDownIcon, RefreshIcon } from './Icons';
import { MessageBubble } from './MessageBubble';
import { EmptyState } from './EmptyState';

export const ChatView = ({ messages, draft, status, error, retrying, tone, tones, onPickSuggestion, onRegenerate, onRetry, onEdit, onDismissError }) => {
  const scrollRef = useRef(null);
  const [following, setFollowing] = useState(true);
  const toneLabel = (id) => tones.find((t) => t.id === id)?.label;

  // Follow the stream only while the user is at the bottom; if they scroll up
  // to read, stop yanking the view and offer a "jump to latest" pill instead.
  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setFollowing(el.scrollHeight - el.scrollTop - el.clientHeight < 48);
  }, []);
  const scrollToBottom = useCallback((smooth = true) => {
    const el = scrollRef.current;
    el?.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
  }, []);
  useEffect(() => {
    if (following) scrollToBottom(false);
  }, [messages.length, draft?.content, status, following, scrollToBottom]);
  useEffect(() => { setFollowing(true); }, [messages.length]);

  const last = messages[messages.length - 1];
  const awaitingReply = status === 'idle' && last?.role === 'user' && !draft;

  if (!messages.length && !draft) return <EmptyState tone={tone} onPick={onPickSuggestion} />;

  return (
    <div className="chat" ref={scrollRef} onScroll={onScroll}>
      {!following && (
        <button className="jump" onClick={() => scrollToBottom()}><ArrowDownIcon /> Latest</button>
      )}
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
              onEdit={m.role === 'user' && status === 'idle' && !String(m._id).startsWith('temp-') ? (text) => onEdit(m._id, text) : undefined}
            />
          );
        })}
        {status === 'loading' && !draft && (
          <MessageBubble message={{ role: 'assistant', content: '', tone }} streaming toneLabel={toneLabel} statusText={retrying ? `model busy · retry ${retrying}…` : undefined} />
        )}
        {draft && <MessageBubble message={draft} streaming toneLabel={toneLabel} />}
        {awaitingReply && !error && (
          <div className="msg msg--assistant">
            <div className="msg__avatar"><span style={{ display: 'flex', gap: 2 }}><i style={{ width: 3, height: 3, borderRadius: 2, background: '#fff' }} /><i style={{ width: 3, height: 3, borderRadius: 2, background: '#fff' }} /><i style={{ width: 3, height: 3, borderRadius: 2, background: '#fff' }} /></span></div>
            <div className="msg__body">
              <div className="msg__meta" style={{ marginTop: 6 }}>
                <button className="chip chip--action" onClick={onRetry}><RefreshIcon /> Generate reply</button>
              </div>
            </div>
          </div>
        )}
        {error && (
          <div className="msg msg--assistant">
            <div className="msg__avatar">!</div>
            <div className="msg__body">
              <div className="bubble bubble--error">{error}</div>
              <div className="msg__meta">
                <button className="chip chip--action" onClick={onRetry}>↻ retry</button>
                <button className="chip" onClick={onDismissError}>dismiss</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
