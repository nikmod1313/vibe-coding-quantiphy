import { useEffect, useRef, useState } from 'react';
import { Markdown } from './Markdown';
import { TONE_COLORS } from './ToneToggle';
import { CopyIcon, CheckIcon, RefreshIcon, EditIcon } from './Icons';

const fmtTime = (iso) => (iso ? new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : '');

const RegenerateMenu = ({ tones, onPick }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const close = (e) => !ref.current?.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  return (
    <div className="regen" ref={ref}>
      <button className="icon-btn" title="Regenerate in a different tone" onClick={() => setOpen((o) => !o)}><RefreshIcon /></button>
      {open && (
        <div className="regen__menu">
          <header>Regenerate as</header>
          {tones.map((t) => (
            <button key={t.id} className="regen__item" style={{ '--c': TONE_COLORS[t.id] }} onClick={() => { setOpen(false); onPick(t.id); }}>
              <span className="dot" /> {t.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export const MessageBubble = ({ message, streaming = false, tones = [], toneLabel, onRegenerate, onEdit, statusText }) => {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(message.content);

  const commitEdit = () => {
    const next = text.trim();
    setEditing(false);
    if (next && next !== message.content) onEdit(next);
    else setText(message.content);
  };

  const copy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className={`msg msg--${message.role}`}>
      <div className="msg__avatar">{isUser ? 'You' : <span style={{ display: 'flex', gap: 2 }}><i style={{ width: 3, height: 3, borderRadius: 2, background: '#fff' }} /><i style={{ width: 3, height: 3, borderRadius: 2, background: '#fff' }} /><i style={{ width: 3, height: 3, borderRadius: 2, background: '#fff' }} /></span>}</div>
      <div className="msg__body">
        <div className={`bubble ${editing ? 'bubble--editing' : ''}`}>
          {isUser && editing ? (
            <div className="edit">
              <textarea
                autoFocus
                rows={Math.min(8, Math.max(2, text.split('\n').length))}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitEdit(); }
                  if (e.key === 'Escape') { setText(message.content); setEditing(false); }
                }}
              />
              <div className="edit__bar">
                <span>Sends again from here · replies below will be replaced</span>
                <button className="chip" onClick={() => { setText(message.content); setEditing(false); }}>cancel</button>
                <button className="chip chip--action" onClick={commitEdit}>save & resend</button>
              </div>
            </div>
          ) : isUser ? (
            message.content
          ) : message.content ? (
            <>
              <Markdown>{message.content}</Markdown>
              {streaming && <span className="cursor" />}
            </>
          ) : (
            <span className="thinking"><i /><i /><i /></span>
          )}
        </div>
        <div className="msg__meta">
          {!isUser && message.tone && (
            <span className="chip chip--tone" style={{ '--c': TONE_COLORS[message.tone] }}>
              <span className="dot" /> {toneLabel?.(message.tone) ?? message.tone}
            </span>
          )}
          {!isUser && message.meta?.latencyMs != null && <span className="chip">{(message.meta.latencyMs / 1000).toFixed(1)}s</span>}
          {!isUser && message.meta?.outputTokens != null && <span className="chip">{message.meta.outputTokens} tok</span>}
          {!isUser && message.meta?.contextMessages != null && (
            <span className="chip" title={message.meta.contextDropped ? `${message.meta.contextDropped} older turn(s) trimmed to fit the context budget` : 'Turns sent as context'}>
              ctx {message.meta.contextMessages}{message.meta.contextDropped ? ` (−${message.meta.contextDropped})` : ''}
            </span>
          )}
          {!isUser && message.meta?.stopped && <span className="chip chip--stopped">stopped</span>}
          {streaming && <span className="chip">{statusText ?? 'streaming…'}</span>}
          <span>{fmtTime(message.createdAt)}</span>
          {!streaming && !editing && (
            <div className="msg__actions">
              {isUser && onEdit && <button className="icon-btn" title="Edit & resend" onClick={() => setEditing(true)}><EditIcon /></button>}
              <button className="icon-btn" title="Copy" onClick={copy}>{copied ? <CheckIcon /> : <CopyIcon />}</button>
              {!isUser && onRegenerate && <RegenerateMenu tones={tones} onPick={onRegenerate} />}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
