import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client';

/** Sidebar state: the list of threads + CRUD helpers. */
export const useConversations = () => {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setConversations(await api.listConversations());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const create = useCallback(async (tone) => {
    const convo = await api.createConversation(tone);
    setConversations((prev) => [{ ...convo, messageCount: 0, preview: '' }, ...prev]);
    return convo;
  }, []);

  const rename = useCallback(async (id, title) => {
    const convo = await api.updateConversation(id, { title });
    setConversations((prev) => prev.map((c) => (c._id === id ? { ...c, title: convo.title } : c)));
  }, []);

  const remove = useCallback(async (id) => {
    await api.deleteConversation(id);
    setConversations((prev) => prev.filter((c) => c._id !== id));
  }, []);

  return { conversations, loading, refresh, create, rename, remove };
};
