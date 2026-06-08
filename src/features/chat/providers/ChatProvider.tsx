// =============================================================================
// ChatProvider
// Owns the lifecycle of the WebSocket connection. Subscribes to the primary
// /user/queue/events fan-in and bridges every event into Redux via the router.
//
// Components consume chat data exclusively via Redux selectors and the hooks
// in `./hooks.ts`. The provider itself exposes nothing through context - it
// only wires up side effects.
// =============================================================================
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useAppDispatch, useAppSelector } from "../../../store/hooks";
// import { chatTransport, type ConnectionState } from "../transport/stompClient";
import { chatTransport, type ConnectionState } from "../transport/index";
import { dispatchRealtimeEvent } from "../eventRouter";
import {
  fetchConversations,
  markMessageFailed,
  queueOutgoingMessage,
  retryMessage,
  setConnectionState,
} from "../chatSlice";
import { STOMP_DESTINATIONS, type ID, type Message, type SendMessageRequest } from "../types";

interface ChatContextValue {
  connection: ConnectionState;
  sendMessage: (req: Omit<SendMessageRequest, "clientId">) => void;
  setTyping: (conversationId: ID, typing: boolean) => void;
  markRead: (conversationId: ID, upToMessageId: ID) => void;
  toggleReaction: (conversationId: ID, messageId: ID, emoji: string) => void;
  resendFailed: (clientId: ID) => void;
  forceReconnect: () => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);

const newClientId = () => `cm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const dispatch = useAppDispatch();
  const currentUserId = useAppSelector((s) => s.chat.currentUserId);
  const pendingByClientId = useAppSelector((s) => s.chat.pendingByClientId);
  const [connection, setConnection] = useState<ConnectionState>("DISCONNECTED");
  const pendingRef = useRef(pendingByClientId);
  pendingRef.current = pendingByClientId;

  // ---- Connection lifecycle ----
  useEffect(() => {
    const unsubState = chatTransport.onConnectionChange((s) => {
      setConnection(s);
      dispatch(setConnectionState(s));
    });

    let primarySub: { unsubscribe: () => void } | null = null;

    const start = async () => {
      await chatTransport.connect();
      // PRIMARY event fan-in: every server event lands here.
      primarySub = chatTransport.subscribe(STOMP_DESTINATIONS.USER_QUEUE_EVENTS, (event) => {
        dispatchRealtimeEvent(dispatch, event);
      });
      // Initial REST hydration
      dispatch(fetchConversations());
    };

    void start();

    return () => {
      primarySub?.unsubscribe();
      unsubState();
      chatTransport.disconnect();
    };
  }, [dispatch]);

  // ---- Retry queue: any PENDING message > 8s without ack is marked FAILED ----
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      Object.values(pendingRef.current).forEach((m) => {
        const ageMs = now - new Date(m.createdAt).getTime();
        if (m.status === "PENDING" && ageMs > 8000) {
          dispatch(markMessageFailed({ clientId: m.clientId! }));
        }
      });
    }, 2000);
    return () => clearInterval(interval);
  }, [dispatch]);

  // ---- Imperative actions exposed via context ----
  const value = useMemo<ChatContextValue>(
    () => ({
      connection,
      sendMessage: (req) => {
        const clientId = newClientId();
        const optimistic: Message = {
          id: clientId,
          clientId,
          conversationId: req.conversationId,
          senderId: currentUserId,
          body: req.body,
          attachments: req.attachments ?? [],
          reactions: [],
          status: "PENDING",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          replyToId: req.replyToId,
          deliveredTo: [],
          readBy: [],
        };
        dispatch(queueOutgoingMessage(optimistic));
        chatTransport.send(STOMP_DESTINATIONS.SEND_MESSAGE, { ...req, clientId });
      },
      setTyping: (conversationId, typing) => {
        chatTransport.send(STOMP_DESTINATIONS.TYPING, { conversationId, typing });
      },
      markRead: (conversationId, upToMessageId) => {
        chatTransport.send(STOMP_DESTINATIONS.READ, { conversationId, upToMessageId });
      },
      toggleReaction: (conversationId, messageId, emoji) => {
        chatTransport.send(STOMP_DESTINATIONS.REACTION, { conversationId, messageId, emoji });
      },
      resendFailed: (clientId) => {
        const m = pendingRef.current[clientId];
        if (!m) return;
        dispatch(retryMessage({ clientId }));
        chatTransport.send(STOMP_DESTINATIONS.SEND_MESSAGE, {
          conversationId: m.conversationId,
          body: m.body,
          attachments: m.attachments,
          replyToId: m.replyToId,
          clientId,
        });
      },
      forceReconnect: () => chatTransport.forceReconnect(),
    }),
    [connection, currentUserId, dispatch],
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChatContext() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChatContext must be used inside <ChatProvider>");
  return ctx;
}
