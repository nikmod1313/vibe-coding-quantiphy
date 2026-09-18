import { useLayoutEffect, useRef, useState } from 'react';

export const TONE_COLORS = {
  professional: 'var(--tone-professional)',
  casual: 'var(--tone-casual)',
  concise: 'var(--tone-concise)',
};

/**
 * Segmented control for the "vibe check". Purely presentational – the chosen
 * tone id is sent to the server, which owns the actual prompt modifier.
 */
export const ToneToggle = ({ tones, value, onChange, disabled }) => {
  const ref = useRef(null);
  const [thumb, setThumb] = useState({ left: 3, width: 0 });

  useLayoutEffect(() => {
    const el = ref.current?.querySelector(`[data-tone="${value}"]`);
    if (el) setThumb({ left: el.offsetLeft, width: el.offsetWidth });
  }, [value, tones]);

  return (
    <div className="tone-toggle">
      <span className="tone-toggle__label">Tone</span>
      <div className="segmented" ref={ref} role="radiogroup" aria-label="Response tone">
        <span className="segmented__thumb" style={{ left: thumb.left, width: thumb.width, '--tone-color': TONE_COLORS[value] }} />
        {tones.map((t) => (
          <button
            key={t.id}
            type="button"
            role="radio"
            aria-checked={value === t.id}
            data-tone={t.id}
            title={t.description}
            disabled={disabled}
            className={`segmented__btn ${value === t.id ? 'segmented__btn--active' : ''}`}
            style={{ '--c': TONE_COLORS[t.id] }}
            onClick={() => onChange(t.id)}
          >
            <span className="dot" />
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
};
