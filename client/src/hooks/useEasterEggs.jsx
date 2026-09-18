import { useEffect, useState } from 'react';

const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];

/** Purely cosmetic: Konami code → party mode (confetti + rainbow accent) for a few seconds. */
export const useKonami = () => {
  const [party, setParty] = useState(false);
  useEffect(() => {
    let idx = 0;
    const onKey = (e) => {
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      idx = key === KONAMI[idx] ? idx + 1 : key === KONAMI[0] ? 1 : 0;
      if (idx === KONAMI.length) {
        idx = 0;
        setParty(true);
        setTimeout(() => setParty(false), 4500);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return party;
};

export const Confetti = () => (
  <div className="confetti" aria-hidden="true">
    {Array.from({ length: 60 }, (_, i) => (
      <i key={i} style={{ '--x': `${(i * 37) % 100}%`, '--d': `${(i % 7) * 0.12}s`, '--h': `${(i * 47) % 360}` }} />
    ))}
  </div>
);

export const greeting = (date = new Date()) => {
  const h = date.getHours();
  if (h < 5) return 'Burning the midnight oil';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  if (h < 21) return 'Good evening';
  return 'Night owl mode';
};

/**
 * Slash commands typed in the composer. Returns { tone } when the text is a
 * tone command, or null. Presentation-only sugar: the server still receives
 * a tone id like any other toggle change.
 */
export const parseSlashCommand = (text, tones, current) => {
  const m = /^\/(\w+)\s*$/.exec(text.trim());
  if (!m) return null;
  const cmd = m[1].toLowerCase();
  const ids = tones.map((t) => t.id);
  if (ids.includes(cmd)) return { tone: cmd };
  if (cmd === 'vibe' && ids.length) return { tone: ids[(ids.indexOf(current) + 1) % ids.length] };
  return null;
};
