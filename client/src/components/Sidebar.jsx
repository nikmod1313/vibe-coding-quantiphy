import { useState } from 'react';
import { PlusIcon, TrashIcon, EditIcon, SearchIcon } from './Icons';
import { TONE_COLORS } from './ToneToggle';

const plain = (md = '') => md.replace(/[`*_#>]+/g, '').replace(/\s+/g, ' ').trim();

const timeAgo = (iso) => {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const Thread = ({ convo, active, onSelect, onRename, onDelete }) => {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(convo.title);

  const commit = () => {
    setEditing(false);
    const next = title.trim();
    if (next && next !== convo.title) onRename(convo._id, next);
    else setTitle(convo.title);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      className={`thread ${active ? 'thread--active' : ''}`}
      onClick={() => !editing && onSelect(convo._id)}
      onKeyDown={(e) => e.key === 'Enter' && onSelect(convo._id)}
    >
      <div style={{ minWidth: 0 }}>
        {editing ? (
          <input
            className="thread__rename"
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit();
              if (e.key === 'Escape') { setTitle(convo.title); setEditing(false); }
            }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <div className="thread__title">{convo.title}</div>
        )}
        <div className="thread__meta">
          <span className="dot" style={{ width: 6, height: 6, borderRadius: 3, background: TONE_COLORS[convo.tone], flex: 'none' }} />
          <span style={{ whiteSpace: 'nowrap' }}>{timeAgo(convo.updatedAt)}</span>
          {convo.preview && <span className="thread__preview">· {plain(convo.preview)}</span>}
        </div>
      </div>
      <div className="thread__actions">
        <button className="icon-btn" title="Rename" onClick={(e) => { e.stopPropagation(); setEditing(true); }}><EditIcon /></button>
        <button className="icon-btn icon-btn--danger" title="Delete" onClick={(e) => { e.stopPropagation(); onDelete(convo._id); }}><TrashIcon /></button>
      </div>
    </div>
  );
};

export const Sidebar = ({ conversations, loading, query, onQuery, activeId, onSelect, onNew, onRename, onDelete, health }) => (
  <aside className="sidebar">
    <div className="sidebar__header">
      <div className="brand">
        <div className="brand__logo"><span><i /><i /><i /></span></div>
        <div>
          VibeChat
          <span className="brand__sub">AI assistant · tone-aware</span>
        </div>
      </div>
    </div>

    <button className="btn-new" onClick={onNew}>
      <PlusIcon /> New chat <kbd>⌘K</kbd>
    </button>

    <label className="search">
      <SearchIcon />
      <input type="search" placeholder="Search conversations" value={query} onChange={(e) => onQuery(e.target.value)} maxLength={100} />
    </label>

    <div className="sidebar__label">{query ? 'Results' : 'History'}</div>
    <div className="sidebar__list">
      {loading && [1, 2, 3].map((i) => <div key={i} className="skeleton" />)}
      {!loading && conversations.length === 0 && (
        <div className="sidebar__empty">{query ? 'No matches.' : <>No conversations yet.<br />Start one above.</>}</div>
      )}
      {conversations.map((c) => (
        <Thread key={c._id} convo={c} active={c._id === activeId} onSelect={onSelect} onRename={onRename} onDelete={onDelete} />
      ))}
    </div>

    <div className="sidebar__footer">
      <span className={`status-dot ${health ? (health.db === 'connected' && health.ai?.ready ? 'status-dot--ok' : 'status-dot--bad') : ''}`} />
      {health ? (
        <span>{health.ai?.ready ? `${health.ai.provider} · ${health.ai.model}` : 'AI not configured'} · DB {health.db}</span>
      ) : (
        <span>Connecting…</span>
      )}
    </div>
  </aside>
);
