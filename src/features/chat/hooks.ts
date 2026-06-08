// =============================================================================
// Public hooks for the chat module. Components should never reach into Redux
// directly; consume these instead so the public API stays stable.
// =============================================================================
import { useEffect, useMemo } from "react";
import { shallowEqual } from "react-redux";
import { useAppDispatch, useAppSelector } from "../../store/hooks";

const EMPTY_ARRAY: any[] = [];
import { fetchMessages, setActiveConversation } from "./chatSlice";
import { chatTransport } from "./transport/index";
import { STOMP_DESTINATIONS, type ID } from "./types";
import { dispatchRealtimeEvent } from "./eventRouter";

export function useConversations() {
  return useAppSelector((s) => ({
    conversations: s.chat.conversations,
    loading: s.chat.conversationsLoading,
    activeId: s.chat.activeConversationId,
  }), shallowEqual);
}

export function useUsers() {
  return useAppSelector((s) => s.chat.users);
}

export function useConversation(id: ID | null) {
  const dispatch = useAppDispatch();
  const messages = useAppSelector((s) => (id ? s.chat.messages[id] ?? EMPTY_ARRAY : EMPTY_ARRAY));
  const loading = useAppSelector((s) => (id ? !!s.chat.messagesLoading[id] : false));
  const conversation = useAppSelector((s) =>
    id ? s.chat.conversations.find((c) => c.id === id) ?? null : null,
  );
  const typingUserIds = useAppSelector((s) => (id ? s.chat.typing[id] ?? EMPTY_ARRAY : EMPTY_ARRAY), shallowEqual);

  // Hydrate messages on first activation
  useEffect(() => {
    if (id && messages.length === 0 && !loading) dispatch(fetchMessages(id));
  }, [id, messages.length, loading, dispatch]);

  // OPTIONAL conversation-scoped topic subscription (in addition to /user/queue/events).
  // Demonstrates the dual-channel architecture from the spec.
  useEffect(() => {
    if (!id) return;
    const sub = chatTransport.subscribe(STOMP_DESTINATIONS.TOPIC_CONVERSATION(id), (event) => {
      dispatchRealtimeEvent(dispatch, event);
    });
    return () => sub.unsubscribe();
  }, [id, dispatch]);

  return { conversation, messages, loading, typingUserIds };
}

export function useActiveConversation() {
  const dispatch = useAppDispatch();
  const activeId = useAppSelector((s) => s.chat.activeConversationId);
  return useMemo(
    () => ({
      activeId,
      setActive: (id: ID | null) => dispatch(setActiveConversation(id)),
    }),
    [activeId, dispatch],
  );
}

export function usePresence(userId: ID | undefined) {
  return useAppSelector((s) => (userId ? s.chat.users[userId]?.presence : "OFFLINE"));
}

export function useFailedMessages() {
  return useAppSelector((s) =>
    s.chat.failedClientIds.map((cid) => s.chat.pendingByClientId[cid]).filter(Boolean),
    shallowEqual
  );
}

export function useConnectionState() {
  return useAppSelector((s) => s.chat.connection);
}
