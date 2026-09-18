import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { RefreshIcon } from './Icons';

const Flashcard = ({ card, index, onOpen }) => {
  const [flipped, setFlipped] = useState(false);
  return (
    <button className={`flashcard ${flipped ? 'flashcard--flipped' : ''}`} onClick={() => setFlipped((f) => !f)} style={{ animationDelay: `${index * 60}ms` }}>
      <div className="flashcard__inner">
        <div className="flashcard__face flashcard__front">
          <span className="flashcard__label">Topic</span>
          <h3>{card.topic}</h3>
          <p>{card.takeaway}</p>
          <span className="flashcard__hint">tap for a new insight →</span>
        </div>
        <div className="flashcard__face flashcard__back">
          <span className="flashcard__label">New insight</span>
          <p>{card.insight}</p>
          {card.question && <p className="flashcard__q">❓ {card.question}</p>}
          {card.conversationId && (
            <span className="flashcard__src" onClick={(e) => { e.stopPropagation(); onOpen(card.conversationId); }}>
              from “{card.conversationTitle}” ↗
            </span>
          )}
        </div>
      </div>
    </button>
  );
};

export const InsightsPanel = ({ onClose, onOpenConversation }) => {
  const [state, setState] = useState({ loading: true, data: null, error: null });

  const load = (refresh = false) => {
    setState({ loading: true, data: null, error: null });
    api.dailyInsights(refresh)
      .then((data) => setState({ loading: false, data, error: null }))
      .catch((err) => setState({ loading: false, data: null, error: err.message }));
  };

  useEffect(() => { load(false); }, []);
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const { loading, data, error } = state;

  return (
    <div className="overlay" onClick={onClose}>
      <div className="insights" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Daily insights">
        <header className="insights__head">
          <div>
            <span className="insights__kicker">Daily summary</span>
            <h2>{data?.headline ?? 'Flashcards from your recent chats'}</h2>
            {data && <small>{data.sources} conversation{data.sources === 1 ? '' : 's'} · {data.cached ? 'cached for today' : 'freshly generated'}</small>}
          </div>
          <div className="insights__actions">
            <button className="icon-btn icon-btn--lg" title="Regenerate" onClick={() => load(true)} disabled={loading}><RefreshIcon /></button>
            <button className="icon-btn icon-btn--lg" title="Close" onClick={onClose}>✕</button>
          </div>
        </header>

        {loading && (
          <div className="insights__grid">{[0, 1, 2].map((i) => <div key={i} className="skeleton skeleton--card" />)}</div>
        )}
        {error && <div className="insights__empty">{error}</div>}
        {data && (
          <div className="insights__grid">
            {data.cards.map((c, i) => <Flashcard key={i} card={c} index={i} onOpen={(id) => { onOpenConversation(id); onClose(); }} />)}
          </div>
        )}
      </div>
    </div>
  );
};
