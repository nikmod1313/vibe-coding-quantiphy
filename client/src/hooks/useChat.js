import { useCallback, useEffect, useRef, useState } from 'react';
import { api, streamMessage } from '../api/client';

/**
 * Streaming state machine for the active conversation.
 * status: idle | loading | streaming
 */
export const useChat = (conversationId, { onConversationUpdated } = {}) => {
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [status, setStatus] = useState('idle');
  const [draft, setDraft] = useState(null); // in-flight assistant message
  const [error, setError] = useState(null);
  const abortRef = useRef(null);

  // Load thread when the selection changes.
  useEffect(() => {
    abortRef.current?.abort();
    setDraft(null);
    setError(null);
    setStatus('idle');
    if (!conversationId) {
      setConversation(null);
      setMessages([]);
      return;
    }
    let cancelled = false;
    api.getConversation(conversationId).then((convo) => {
      if (cancelled) return;
      setConversation(convo);
      setMessages(convo.messages);
    }).catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [conversationId]);

  const [retrying, setRetrying] = useState(null);

  /**
   * @param {string|null} content  user prompt, or null to regenerate the last answer
   * @param {string} [tone]        tone override for this turn
   */
  const send = useCallback(
    async (content, tone) => {
      if (!conversationId || status !== 'idle') return;
      const regenerate = content == null;
      setError(null);
      setRetrying(null);
      setStatus('loading');

      const controller = new AbortController();
      abortRef.current = controller;

      // Optimistic user bubble; replaced by the persisted one from the server.
      const tempId = `temp-${Date.now()}`;
      if (!regenerate) {
        setMessages((prev) => [...prev, { _id: tempId, role: 'user', content, createdAt: new Date().toISOString() }]);
      }

      try {
        await streamMessage({
          conversationId,
          content,
          regenerate,
          tone,
          signal: controller.signal,
          onEvent: (event, data) => {
            switch (event) {
              case 'user_message':
                setMessages((prev) => prev.map((m) => (m._id === tempId ? data.message : m)));
                break;
              case 'start':
                setStatus('streaming');
                setDraft({ role: 'assistant', content: '', tone: data.tone, meta: { model: data.model } });
                setConversation((c) => (c ? { ...c, tone: data.tone } : c));
                break;
              case 'retry':
                setRetrying(data.attempt);
                break;
              case 'token':
                setRetrying(null);
                setDraft((d) => (d ? { ...d, content: d.content + data.text } : d));
                break;
              case 'done':
                if (data.message) setMessages((prev) => [...prev, data.message]);
                setDraft(null);
                onConversationUpdated?.();
                break;
              case 'title':
                setConversation((c) => (c ? { ...c, title: data.title } : c));
                onConversationUpdated?.();
                break;
              case 'error':
                setError(data.message);
                setDraft(null);
                break;
              default:
                break;
            }
          },
        });
      } catch (err) {
        if (err.name !== 'AbortError') setError(err.message);
        // On abort the server persists the partial reply; reload to pick it up.
        if (err.name === 'AbortError') {
          api.getConversation(conversationId).then((c) => setMessages(c.messages)).catch(() => {});
          onConversationUpdated?.();
        }
        setDraft(null);
      } finally {
        setStatus('idle');
        setRetrying(null);
        abortRef.current = null;
      }
    },
    [conversationId, status, onConversationUpdated],
  );

  const stop = useCallback(() => abortRef.current?.abort(), []);
  const retry = useCallback(() => send(null), [send]);

  const setTone = useCallback(
    async (tone) => {
      if (!conversationId) return;
      setConversation((c) => (c ? { ...c, tone } : c));
      await api.updateConversation(conversationId, { tone });
    },
    [conversationId],
  );

  return { conversation, messages, draft, status, error, retrying, send, stop, retry, setTone, setError };
};
