import { useEffect, useRef, useState } from 'react';
import { SendIcon, StopIcon } from './Icons';

export const Composer = ({ onSend, onStop, status, disabled, focusKey, onSlashCommand, tones = [], tone }) => {
  const [value, setValue] = useState('');
  const ref = useRef(null);
  const busy = status !== 'idle';

  useEffect(() => { ref.current?.focus(); }, [focusKey]);

  // Auto-grow the textarea.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!value) {
      el.style.height = '';
      return;
    }
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [value]);

  const [flash, setFlash] = useState(null);
  const isCommand = /^\/\w*$/.test(value.trim());

  const submit = () => {
    const text = value.trim();
    if (!text || busy || disabled) return;
    const cmd = onSlashCommand?.(text);
    if (cmd?.tone) {
      const label = tones.find((t) => t.id === cmd.tone)?.label ?? cmd.tone;
      setFlash(`Tone → ${label}`);
      setTimeout(() => setFlash(null), 1400);
      setValue('');
      return;
    }
    onSend(text);
    setValue('');
  };

  return (
    <div className="composer">
      <div className="composer__box">
        <textarea
          ref={ref}
          rows={1}
          value={value}
          disabled={disabled}
          placeholder={disabled ? 'Select or create a conversation to start' : 'Message VibeChat…'}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
          }}
        />
        {busy ? (
          <button className="composer__send composer__send--stop" title="Stop generating" onClick={onStop}><StopIcon /></button>
        ) : (
          <button className="composer__send" title="Send" disabled={!value.trim() || disabled} onClick={submit}><SendIcon /></button>
        )}
      </div>
      <div className={`composer__hint ${flash || isCommand ? 'composer__hint--active' : ''}`}>
        {flash ? (
          <span className="composer__flash">✨ {flash}</span>
        ) : isCommand ? (
          <>Commands: {tones.map((t) => <kbd key={t.id} className={t.id === tone ? 'kbd--on' : ''}>/{t.id}</kbd>)} <kbd>/vibe</kbd> cycles</>
        ) : (
          <><kbd>Enter</kbd> to send · <kbd>Shift</kbd>+<kbd>Enter</kbd> for a new line · <kbd>⌘K</kbd> new chat · <kbd>/</kbd> commands</>
        )}
      </div>
    </div>
  );
};
