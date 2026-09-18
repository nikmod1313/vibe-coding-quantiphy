import { useCallback, useEffect, useState } from 'react';
import { api } from './api/client';
import { useConversations } from './hooks/useConversations';
import { useChat } from './hooks/useChat';
import { Sidebar } from './components/Sidebar';
import { ToneToggle } from './components/ToneToggle';
import { ChatView } from './components/ChatView';
import { Composer } from './components/Composer';

export default function App() {
  const [tones, setTones] = useState([]);
  const [defaultTone, setDefaultTone] = useState('professional');
  const [activeId, setActiveId] = useState(null);
  const [health, setHealth] = useState(null);
  const [focusKey, setFocusKey] = useState(0);

  const { conversations, loading, refresh, create, rename, remove } = useConversations();
  const chat = useChat(activeId, { onConversationUpdated: refresh });

  // Bootstrap: tone presets + health.
  useEffect(() => {
    api.tones().then((d) => { setTones(d.tones); setDefaultTone(d.default); }).catch(() => {});
    const ping = () => api.health().then(setHealth).catch(() => setHealth({ db: 'down', ai: { ready: false } }));
    ping();
    const id = setInterval(ping, 15000);
    return () => clearInterval(id);
  }, []);

  const activeTone = chat.conversation?.tone ?? defaultTone;

  const newChat = useCallback(async () => {
    const convo = await create(activeTone);
    setActiveId(convo._id);
    setFocusKey((k) => k + 1);
  }, [create, activeTone]);

  // Sending from the empty state with no thread yet creates one on the fly.
  const send = useCallback(
    async (text) => {
      let id = activeId;
      if (!id) {
        const convo = await create(activeTone);
        id = convo._id;
        setActiveId(id);
        // useChat re-binds to the new id on next render; defer the send.
        setTimeout(() => window.dispatchEvent(new CustomEvent('vibechat:send', { detail: { id, text } })), 0);
        return;
      }
      chat.send(text);
    },
    [activeId, activeTone, create, chat],
  );

  useEffect(() => {
    const handler = (e) => {
      if (e.detail.id === activeId && chat.conversation?._id === activeId) chat.send(e.detail.text);
    };
    window.addEventListener('vibechat:send', handler);
    return () => window.removeEventListener('vibechat:send', handler);
  }, [activeId, chat]);

  const regenerate = useCallback(
    (tone) => {
      const lastUser = [...chat.messages].reverse().find((m) => m.role === 'user');
      if (lastUser) chat.send(lastUser.content, tone);
    },
    [chat],
  );

  const onDelete = useCallback(
    async (id) => {
      await remove(id);
      if (id === activeId) setActiveId(null);
    },
    [remove, activeId],
  );

  // Keyboard shortcuts.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); newChat(); }
      if (e.key === 'Escape' && chat.status !== 'idle') chat.stop();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [newChat, chat]);

  const title = chat.conversation?.title ?? 'New conversation';

  return (
    <div className="app">
      <Sidebar
        conversations={conversations}
        loading={loading}
        activeId={activeId}
        onSelect={setActiveId}
        onNew={newChat}
        onRename={rename}
        onDelete={onDelete}
        health={health}
      />
      <main className="main">
        <header className="topbar">
          <div className="topbar__title">
            {title}
            <small>{chat.messages.length ? `${chat.messages.length} messages` : 'Responses adapt to the selected tone'}</small>
          </div>
          <ToneToggle
            tones={tones}
            value={activeTone}
            disabled={chat.status !== 'idle'}
            onChange={(t) => (activeId ? chat.setTone(t) : setDefaultTone(t))}
          />
        </header>

        <ChatView
          messages={chat.messages}
          draft={chat.draft}
          status={chat.status}
          error={chat.error}
          tone={activeTone}
          tones={tones}
          onPickSuggestion={send}
          onRegenerate={regenerate}
          onDismissError={() => chat.setError(null)}
        />

        <Composer onSend={send} onStop={chat.stop} status={chat.status} focusKey={focusKey} />
      </main>
    </div>
  );
}
