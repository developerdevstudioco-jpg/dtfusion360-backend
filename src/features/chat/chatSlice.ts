// =============================================================================
// chatSlice
// Normalized chat state, designed for event-driven updates.
// Reducers are intentionally pure: they apply discrete realtime events
// (MESSAGE_NEW, MESSAGE_ACK, TYPING_*, PRESENCE_UPDATE, ...) so the same
// reducers serve both /user/queue/events fan-in and per-conversation topics.
// =============================================================================
import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit";
import type {
  ContactItem,
  Conversation,
  ID,
  Message,
  MessageAckPayload,
  PresencePayload,
  ReactionPayload,
  ReadPayload,
  TypingPayload,
  UnreadCountPayload,
  User,
} from "./types";
import { CURRENT_USER_ID } from "./mocks/data";
import { chatApi } from "./api/chatApi";

interface MessagesByConversation {
  [conversationId: string]: Message[];
}

interface TypingByConversation {
  [conversationId: string]: ID[]; // user ids currently typing
}

export interface ChatState {
  currentUserId: ID;
  connection: "DISCONNECTED" | "CONNECTING" | "CONNECTED" | "RECONNECTING";
  conversations: Conversation[];
  conversationsLoading: boolean;
  activeConversationId: ID | null;
  messages: MessagesByConversation;
  messagesLoading: Record<ID, boolean>;
  users: Record<ID, User>;
  typing: TypingByConversation;
  // Pending optimistic messages keyed by clientId (for retry queue)
  pendingByClientId: Record<ID, Message>;
  failedClientIds: ID[];
}

const initialState: ChatState = {
  currentUserId: CURRENT_USER_ID,
  connection: "DISCONNECTED",
  conversations: [],
  conversationsLoading: false,
  activeConversationId: null,
  messages: {},
  messagesLoading: {},
  users: {},
  typing: {},
  pendingByClientId: {},
  failedClientIds: [],
};

// =============================================================================
// Async thunks (REST) — Simplified 3-endpoint design
// =============================================================================

/** Fetches sidebar contacts, then derives Conversation[] + User map from ContactItem[] */
export const fetchConversations = createAsyncThunk("chat/fetchConversations", async () => {
  const contacts: ContactItem[] = await chatApi.getContacts();

  // Transform ContactItem[] → Conversation[]
  const conversations: Conversation[] = contacts.map((c) => ({
    id: c.conversationId,
    type: c.type,
    title: c.type === "GROUP" ? c.name : undefined,
    avatarUrl: c.avatarUrl,
    participantIds: c.participantIds,
    lastMessage: c.lastMessage
      ? ({ body: c.lastMessage.body, senderId: c.lastMessage.senderId, createdAt: c.lastMessage.createdAt } as Message)
      : undefined,
    unreadCount: c.unreadCount,
    createdAt: c.updatedAt, // contacts API doesn't return createdAt separately
    updatedAt: c.updatedAt,
    isMuted: c.isMuted,
    isPinned: c.isPinned,
  }));

  // Build a User map from DIRECT contacts (for avatars/presence in sidebar)
  const users: User[] = contacts
    .filter((c) => c.type === "DIRECT")
    .map((c) => {
      const otherId = c.participantIds.find((p) => p !== CURRENT_USER_ID) ?? c.participantIds[0];
      return {
        id: otherId,
        name: c.name,
        avatarUrl: c.avatarUrl,
        presence: c.presence ?? "OFFLINE",
        lastSeenAt: c.lastSeenAt,
      } as User;
    });

  return { conversations, users };
});

/** Fetches global user directory for chat discovery and filters */
export const fetchUsers = createAsyncThunk("chat/fetchUsers", async () => {
  return await chatApi.getUsers();
});

/** Fetches paginated messages + full participant details for a conversation */
export const fetchMessages = createAsyncThunk(
  "chat/fetchMessages",
  async (conversationId: ID) => {
    const resp = await chatApi.getMessages(conversationId, 1, 50);
    return { conversationId, messages: resp.data, participants: resp.participants };
  },
);

// =============================================================================
// Slice
// =============================================================================
const chatSlice = createSlice({
  name: "chat",
  initialState,
  reducers: {
    setConnectionState(state, action: PayloadAction<ChatState["connection"]>) {
      state.connection = action.payload;
    },
    setActiveConversation(state, action: PayloadAction<ID | null>) {
      state.activeConversationId = action.payload;
      if (action.payload) {
        const conv = state.conversations.find((c) => c.id === action.payload);
        if (conv) conv.unreadCount = 0;
      }
    },

    // Optimistic outbound: caller provides a Message in PENDING status.
    queueOutgoingMessage(state, action: PayloadAction<Message>) {
      const m = action.payload;
      const list = state.messages[m.conversationId] ?? [];
      list.push(m);
      state.messages[m.conversationId] = list;
      if (m.clientId) state.pendingByClientId[m.clientId] = m;
    },

    markMessageFailed(state, action: PayloadAction<{ clientId: ID }>) {
      const m = state.pendingByClientId[action.payload.clientId];
      if (!m) return;
      m.status = "FAILED";
      if (!state.failedClientIds.includes(action.payload.clientId)) {
        state.failedClientIds.push(action.payload.clientId);
      }
    },

    retryMessage(state, action: PayloadAction<{ clientId: ID }>) {
      const m = state.pendingByClientId[action.payload.clientId];
      if (!m) return;
      m.status = "PENDING";
      state.failedClientIds = state.failedClientIds.filter((id) => id !== action.payload.clientId);
    },

    // ---------------- Realtime event reducers ----------------
    eventMessageNew(state, action: PayloadAction<Message>) {
      const m = action.payload;
      const list = state.messages[m.conversationId] ?? [];
      // Avoid duplicates if also acked locally
      if (!list.find((x) => x.id === m.id)) list.push(m);
      state.messages[m.conversationId] = list;

      const conv = state.conversations.find((c) => c.id === m.conversationId);
      if (conv) {
        conv.lastMessage = m;
        conv.updatedAt = m.createdAt;
        if (m.senderId !== state.currentUserId && state.activeConversationId !== m.conversationId) {
          conv.unreadCount += 1;
        }
      }
    },

    eventMessageAck(state, action: PayloadAction<MessageAckPayload>) {
      const { clientId, message } = action.payload;
      const list = state.messages[message.conversationId] ?? [];
      const idx = list.findIndex((m) => m.clientId === clientId || m.id === clientId);
      if (idx >= 0) {
        list[idx] = { ...message, clientId };
      } else {
        list.push(message);
      }
      state.messages[message.conversationId] = list;
      delete state.pendingByClientId[clientId];
      state.failedClientIds = state.failedClientIds.filter((id) => id !== clientId);
    },

    eventMessageDelivered(
      state,
      action: PayloadAction<{ messageId: ID; conversationId: ID; userIds: ID[] }>,
    ) {
      const { messageId, conversationId, userIds } = action.payload;
      const list = state.messages[conversationId];
      if (!list) return;
      const m = list.find((x) => x.id === messageId);
      if (!m) return;
      userIds.forEach((u) => {
        if (!m.deliveredTo.includes(u)) m.deliveredTo.push(u);
      });
      if (m.status === "SENT") m.status = "DELIVERED";
    },

    eventMessageRead(state, action: PayloadAction<ReadPayload>) {
      const { conversationId, userId, upToMessageId } = action.payload;
      const list = state.messages[conversationId];
      if (!list) return;
      const idx = list.findIndex((m) => m.id === upToMessageId);
      if (idx < 0) return;
      for (let i = 0; i <= idx; i++) {
        if (!list[i].readBy.includes(userId)) list[i].readBy.push(userId);
        if (list[i].senderId !== userId) list[i].status = "READ";
      }
    },

    eventTyping(state, action: PayloadAction<TypingPayload & { typing: boolean }>) {
      const { conversationId, userId, typing } = action.payload;
      const current = state.typing[conversationId] ?? [];
      if (typing) {
        if (!current.includes(userId)) state.typing[conversationId] = [...current, userId];
      } else {
        state.typing[conversationId] = current.filter((u) => u !== userId);
      }
    },

    eventPresence(state, action: PayloadAction<PresencePayload>) {
      const { userId, status, lastSeenAt } = action.payload;
      const u = state.users[userId];
      if (u) {
        u.presence = status;
        if (lastSeenAt) u.lastSeenAt = lastSeenAt;
      }
    },

    eventReaction(
      state,
      action: PayloadAction<ReactionPayload & { kind: "ADDED" | "REMOVED" }>,
    ) {
      const { conversationId, messageId, emoji, userId, kind } = action.payload;
      const list = state.messages[conversationId];
      if (!list) return;
      const m = list.find((x) => x.id === messageId);
      if (!m) return;
      let r = m.reactions.find((x) => x.emoji === emoji);
      if (kind === "ADDED") {
        if (!r) {
          r = { emoji, userIds: [userId] };
          m.reactions.push(r);
        } else if (!r.userIds.includes(userId)) {
          r.userIds.push(userId);
        }
      } else if (r) {
        r.userIds = r.userIds.filter((u) => u !== userId);
        if (r.userIds.length === 0) {
          m.reactions = m.reactions.filter((x) => x.emoji !== emoji);
        }
      }
    },

    eventConversationCreated(state, action: PayloadAction<Conversation>) {
      if (!state.conversations.find((c) => c.id === action.payload.id)) {
        state.conversations.unshift(action.payload);
      }
    },

    eventUnreadCountUpdated(state, action: PayloadAction<UnreadCountPayload>) {
      const conv = state.conversations.find((c) => c.id === action.payload.conversationId);
      if (conv) conv.unreadCount = action.payload.unreadCount;
    },
  },
  extraReducers: (b) => {
    b.addCase(fetchConversations.pending, (s) => {
      s.conversationsLoading = true;
    });
    b.addCase(fetchConversations.fulfilled, (s, a) => {
      s.conversationsLoading = false;
      s.conversations = a.payload.conversations;
      s.users = Object.fromEntries(a.payload.users.map((u) => [u.id, u]));
    });
    b.addCase(fetchConversations.rejected, (s) => {
      s.conversationsLoading = false;
    });
    b.addCase(fetchMessages.pending, (s, a) => {
      s.messagesLoading[a.meta.arg] = true;
    });
    b.addCase(fetchMessages.fulfilled, (s, a) => {
      s.messagesLoading[a.payload.conversationId] = false;
      s.messages[a.payload.conversationId] = a.payload.messages;
      // Merge participant details into users map (enriches data for chat header)
      a.payload.participants.forEach((u) => {
        s.users[u.id] = { ...s.users[u.id], ...u };
      });
    });
    b.addCase(fetchMessages.rejected, (s, a) => {
      s.messagesLoading[a.meta.arg] = false;
    });
    b.addCase(fetchUsers.fulfilled, (s, a) => {
      s.users = { ...s.users, ...Object.fromEntries(a.payload.map((u) => [u.id, u])) };
    });
  },
});

export const {
  setConnectionState,
  setActiveConversation,
  queueOutgoingMessage,
  markMessageFailed,
  retryMessage,
  eventMessageNew,
  eventMessageAck,
  eventMessageDelivered,
  eventMessageRead,
  eventTyping,
  eventPresence,
  eventReaction,
  eventConversationCreated,
  eventUnreadCountUpdated,
} = chatSlice.actions;

export default chatSlice.reducer;
