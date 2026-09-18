import { useEffect, useRef, useState } from 'react';
import { SendIcon, StopIcon } from './Icons';

export const Composer = ({ onSend, onStop, status, disabled, focusKey }) => {
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

  const submit = () => {
    const text = value.trim();
    if (!text || busy || disabled) return;
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
      <div className="composer__hint"><kbd>Enter</kbd> to send · <kbd>Shift</kbd>+<kbd>Enter</kbd> for a new line · <kbd>⌘K</kbd> new chat</div>
    </div>
  );
};
