// =============================================================================
// MockChatServer
// In-memory simulation of the future backend. Holds canonical state,
// produces realtime events, and routes STOMP-style sends to subscribers.
//
// This file is the ONLY place that knows the "server truth". The mock
// REST client and the mock STOMP transport both delegate here.
// =============================================================================
import type {
  Conversation,
  ID,
  Message,
  MessageAckPayload,
  PresencePayload,
  ReactionPayload,
  ReadPayload,
  RealtimeEvent,
  SendMessageRequest,
  TypingPayload,
  UnreadCountPayload,
  User,
} from "../types";
import { CURRENT_USER_ID, mockConversations, mockMessages, mockUsers } from "./data";

type Listener = (event: RealtimeEvent) => void;

const uid = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
const nowIso = () => new Date().toISOString();
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

class MockChatServer {
  private users = new Map<ID, User>(clone(mockUsers).map((u: User) => [u.id, u]));
  private conversations = new Map<ID, Conversation>(
    clone(mockConversations).map((c: Conversation) => [c.id, c]),
  );
  private messages = new Map<ID, Message[]>(Object.entries(clone(mockMessages)));
  private listeners = new Set<Listener>();
  private simulationTimer: ReturnType<typeof setInterval> | null = null;

  // ---------------- subscriptions (server -> client) ----------------
  subscribe(cb: Listener): () => void {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  private emit<T>(event: RealtimeEvent<T>) {
    // Never leak mutable server references into Redux state.
    const safeEvent = clone(event) as RealtimeEvent<T>;
    // microtask defer to mimic network
    queueMicrotask(() => {
      this.listeners.forEach((l) => l(safeEvent));
    });
  }

  // ---------------- REST API mock implementations ----------------

  /** GET /api/chat/contacts — sidebar listing */
  getContacts(): import("../types").ContactItem[] {
    const sorted = Array.from(this.conversations.values()).sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
    return clone(sorted.map((conv) => {
      const otherId = conv.participantIds.find((p) => p !== CURRENT_USER_ID);
      const other = otherId ? this.users.get(otherId) : undefined;
      return {
        conversationId: conv.id,
        type: conv.type,
        name: conv.type === "GROUP" ? (conv.title ?? "Group") : (other?.name ?? "Unknown"),
        avatarUrl: conv.type === "GROUP" ? conv.avatarUrl : other?.avatarUrl,
        presence: conv.type === "DIRECT" ? other?.presence : undefined,
        lastSeenAt: conv.type === "DIRECT" ? other?.lastSeenAt : undefined,
        lastMessage: conv.lastMessage
          ? { body: conv.lastMessage.body, senderId: conv.lastMessage.senderId, createdAt: conv.lastMessage.createdAt }
          : undefined,
        unreadCount: conv.unreadCount,
        participantIds: conv.participantIds,
        isMuted: conv.isMuted,
        isPinned: conv.isPinned,
        updatedAt: conv.updatedAt,
      };
    }));
  }

  /** GET /api/chat/messages/{id}?page&pageSize — paginated messages + participant details */
  getMessages(conversationId: ID, page = 1, pageSize = 50): import("../types").ConversationMessagesResponse {
    const all = this.messages.get(conversationId) ?? [];
    const start = Math.max(0, all.length - page * pageSize);
    const end = all.length - (page - 1) * pageSize;
    const slice = clone(all.slice(start, end));

    const conv = this.conversations.get(conversationId);
    const participants = conv
      ? conv.participantIds.map((uid) => this.users.get(uid)).filter(Boolean) as User[]
      : [];

    return {
      data: slice,
      page,
      pageSize,
      total: all.length,
      hasMore: start > 0,
      participants: clone(participants),
    };
  }

  /** POST /api/chat/media — mock media upload using real blob URLs for preview */
  uploadMedia(_files: File[]): import("../types").MediaUploadResponse {
    const attachments = _files.map((f) => {
      const blobUrl = URL.createObjectURL(f);
      return {
        id: uid("att"),
        kind: f.type.startsWith("image/") ? "IMAGE" as const
          : f.type.startsWith("video/") ? "VIDEO" as const
          : f.type.startsWith("audio/") ? "AUDIO" as const
          : "FILE" as const,
        url: blobUrl,
        name: f.name,
        size: f.size,
        mimeType: f.type,
        thumbnailUrl: f.type.startsWith("image/") ? blobUrl : undefined,
      };
    });
    return { attachments };
  }

  // --- Internal helpers (used by simulation engine) ---
  listConversations(): Conversation[] {
    return clone(Array.from(this.conversations.values()).sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    ));
  }
  listUsers(): User[] {
    return clone(Array.from(this.users.values()));
  }
  listMessages(conversationId: ID): Message[] {
    return clone(this.messages.get(conversationId) ?? []);
  }
  getConversation(id: ID): Conversation | undefined {
    const c = this.conversations.get(id);
    return c ? clone(c) : undefined;
  }

  // ---------------- writes (client -> server STOMP /app/*) ----------------
  sendMessage(req: SendMessageRequest, senderId: ID = CURRENT_USER_ID): Message {
    const message: Message = {
      id: uid("m"),
      clientId: req.clientId,
      conversationId: req.conversationId,
      senderId,
      body: req.body,
      attachments: req.attachments ?? [],
      reactions: [],
      status: "SENT",
      createdAt: nowIso(),
      updatedAt: nowIso(),
      replyToId: req.replyToId,
      deliveredTo: [],
      readBy: [],
    };

    const list = this.messages.get(req.conversationId) ?? [];
    list.push(message);
    this.messages.set(req.conversationId, list);

    const conv = this.conversations.get(req.conversationId);
    if (conv) {
      conv.lastMessage = message;
      conv.updatedAt = message.createdAt;
      this.conversations.set(conv.id, { ...conv });
    }

    // 1) ACK to sender (clientId -> serverId)
    this.emit<MessageAckPayload>({
      type: "MESSAGE_ACK",
      ts: nowIso(),
      payload: { clientId: req.clientId, message },
    });

    // 2) Broadcast new message (other clients would receive on their /user/queue/events)
    this.emit<Message>({ type: "MESSAGE_NEW", ts: nowIso(), payload: message });

    // 3) Simulate auto-delivery + read after a short delay (other participant)
    setTimeout(() => this.simulateDelivery(message), 600);

    return clone(message);
  }

  private simulateDelivery(message: Message) {
    const conv = this.conversations.get(message.conversationId);
    if (!conv) return;
    const others = conv.participantIds.filter((p) => p !== message.senderId);
    others.forEach((uid) => {
      message.deliveredTo.push(uid);
    });
    this.emit({
      type: "MESSAGE_DELIVERED",
      ts: nowIso(),
      payload: { messageId: message.id, conversationId: conv.id, userIds: others },
    });
  }

  setTyping(conversationId: ID, userId: ID, typing: boolean) {
    const payload: TypingPayload = { conversationId, userId };
    this.emit({ type: typing ? "TYPING_START" : "TYPING_STOP", ts: nowIso(), payload });
  }

  markRead(conversationId: ID, userId: ID, upToMessageId: ID) {
    const list = this.messages.get(conversationId) ?? [];
    const idx = list.findIndex((m) => m.id === upToMessageId);
    if (idx >= 0) {
      for (let i = 0; i <= idx; i++) {
        if (!list[i].readBy.includes(userId)) list[i].readBy.push(userId);
        if (list[i].senderId !== userId) list[i].status = "READ";
      }
    }
    const conv = this.conversations.get(conversationId);
    if (conv && userId === CURRENT_USER_ID) {
      conv.unreadCount = 0;
      this.conversations.set(conv.id, { ...conv });
      this.emit<UnreadCountPayload>({
        type: "UNREAD_COUNT_UPDATED",
        ts: nowIso(),
        payload: { conversationId, unreadCount: 0 },
      });
    }
    this.emit<ReadPayload>({
      type: "MESSAGE_READ",
      ts: nowIso(),
      payload: { conversationId, userId, upToMessageId, readAt: nowIso() },
    });
  }

  toggleReaction(conversationId: ID, messageId: ID, emoji: string, userId: ID) {
    const list = this.messages.get(conversationId) ?? [];
    const msg = list.find((m) => m.id === messageId);
    if (!msg) return;
    let reaction = msg.reactions.find((r) => r.emoji === emoji);
    let removed = false;
    if (!reaction) {
      reaction = { emoji, userIds: [userId] };
      msg.reactions.push(reaction);
    } else if (reaction.userIds.includes(userId)) {
      reaction.userIds = reaction.userIds.filter((u) => u !== userId);
      removed = true;
      if (reaction.userIds.length === 0) {
        msg.reactions = msg.reactions.filter((r) => r.emoji !== emoji);
      }
    } else {
      reaction.userIds.push(userId);
    }
    msg.updatedAt = nowIso();

    const payload: ReactionPayload = { conversationId, messageId, emoji, userId };
    this.emit({ type: removed ? "REACTION_REMOVED" : "REACTION_ADDED", ts: nowIso(), payload });
  }

  setPresence(userId: ID, status: PresencePayload["status"]) {
    const u = this.users.get(userId);
    if (!u) return;
    u.presence = status;
    u.lastSeenAt = nowIso();
    this.users.set(userId, { ...u });
    this.emit<PresencePayload>({
      type: "PRESENCE_UPDATE",
      ts: nowIso(),
      payload: { userId, status, lastSeenAt: u.lastSeenAt },
    });
  }

  createConversation(type: Conversation["type"], participantIds: ID[], title?: string): Conversation {
    const conv: Conversation = {
      id: uid("c"),
      type,
      title,
      participantIds: Array.from(new Set([CURRENT_USER_ID, ...participantIds])),
      unreadCount: 0,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    this.conversations.set(conv.id, conv);
    this.messages.set(conv.id, []);
    this.emit<Conversation>({ type: "CONVERSATION_CREATED", ts: nowIso(), payload: conv });
    return clone(conv);
  }

  // ---------------- Ambient simulation: incoming messages + presence churn ----------------
  startSimulation() {
    if (this.simulationTimer) return;
    this.simulationTimer = setInterval(() => {
      // Random other user sends a message into a random conversation ~25% of ticks
      if (Math.random() < 0.25) {
        const conv = this.listConversations()[Math.floor(Math.random() * this.conversations.size)];
        if (!conv) return;
        const others = conv.participantIds.filter((p) => p !== CURRENT_USER_ID);
        const senderId = others[Math.floor(Math.random() * others.length)];
        if (!senderId) return;
        const samples = [
          "Got it 👍",
          "Can you take another look?",
          "Pushed an update.",
          "On a call, brb.",
          "Sounds good!",
          "Let's sync after lunch.",
        ];
        const body = samples[Math.floor(Math.random() * samples.length)];
        const msg: Message = {
          id: uid("m"),
          conversationId: conv.id,
          senderId,
          body,
          attachments: [],
          reactions: [],
          status: "DELIVERED",
          createdAt: nowIso(),
          updatedAt: nowIso(),
          deliveredTo: [CURRENT_USER_ID],
          readBy: [],
        };
        const list = this.messages.get(conv.id) ?? [];
        list.push(msg);
        this.messages.set(conv.id, list);
        const updated: Conversation = {
          ...conv,
          lastMessage: msg,
          updatedAt: msg.createdAt,
          unreadCount: conv.unreadCount + 1,
        };
        this.conversations.set(conv.id, updated);

        // Typing tease then message
        this.emit<TypingPayload>({
          type: "TYPING_START",
          ts: nowIso(),
          payload: { conversationId: conv.id, userId: senderId },
        });
        setTimeout(() => {
          this.emit<TypingPayload>({
            type: "TYPING_STOP",
            ts: nowIso(),
            payload: { conversationId: conv.id, userId: senderId },
          });
          this.emit<Message>({ type: "MESSAGE_NEW", ts: nowIso(), payload: msg });
          this.emit<UnreadCountPayload>({
            type: "UNREAD_COUNT_UPDATED",
            ts: nowIso(),
            payload: { conversationId: conv.id, unreadCount: updated.unreadCount },
          });
        }, 900);
      }

      // Random presence flicker
      if (Math.random() < 0.15) {
        const users = this.listUsers().filter((u) => u.id !== CURRENT_USER_ID);
        const u = users[Math.floor(Math.random() * users.length)];
        if (!u) return;
        const next: PresencePayload["status"] =
          u.presence === "ONLINE" ? "AWAY" : u.presence === "AWAY" ? "OFFLINE" : "ONLINE";
        this.setPresence(u.id, next);
      }
    }, 5000);
  }

  stopSimulation() {
    if (this.simulationTimer) {
      clearInterval(this.simulationTimer);
      this.simulationTimer = null;
    }
  }
}

export const mockServer = new MockChatServer();
