// =============================================================================
// Chat Module - Type Definitions
// All API contracts modeled to match a future STOMP/SockJS backend.
// =============================================================================

export type ID = string;

export type ConversationType = "DIRECT" | "GROUP";

export type MessageStatus =
  | "PENDING"   // optimistic, not yet acked by server
  | "SENT"      // ack received from server
  | "DELIVERED" // delivered to at least one recipient
  | "READ"      // read by recipient(s)
  | "FAILED";   // send failed (will be in retry queue)

export type PresenceStatus = "ONLINE" | "AWAY" | "OFFLINE";

export type AttachmentKind = "IMAGE" | "FILE" | "AUDIO" | "VIDEO";

export interface Attachment {
  id: ID;
  kind: AttachmentKind;
  url: string;
  name: string;
  size: number;
  mimeType: string;
  thumbnailUrl?: string;
}

export interface Reaction {
  emoji: string;
  userIds: ID[];
}

export interface User {
  id: ID;
  name: string;
  avatarUrl?: string;
  email?: string;
  mobile?: string;
  role?: string;
  department?: string;
  plant?: string;
  location?: string;
  presence: PresenceStatus;
  lastSeenAt?: string; // ISO
}

export interface Message {
  id: ID;            // server id (or temp client id while PENDING)
  clientId?: ID;     // local correlation id for optimistic updates
  conversationId: ID;
  senderId: ID;
  body: string;
  attachments: Attachment[];
  reactions: Reaction[];
  status: MessageStatus;
  createdAt: string; // ISO
  updatedAt: string; // ISO
  replyToId?: ID;
  editedAt?: string;
  deletedAt?: string;
  deliveredTo: ID[]; // user ids
  readBy: ID[];      // user ids
}

export interface Conversation {
  id: ID;
  type: ConversationType;
  title?: string;          // for groups
  avatarUrl?: string;
  participantIds: ID[];
  lastMessage?: Message;
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
  isMuted?: boolean;
  isPinned?: boolean;
}

// =============================================================================
// REST API DTOs (Simplified 3-endpoint design)
// =============================================================================

/** GET /api/chat/contacts — Each item in the sidebar list */
export interface ContactItem {
  conversationId: ID;
  type: ConversationType;
  name: string;                // DIRECT → other user's full name | GROUP → group title
  avatarUrl?: string;          // DIRECT → other user's avatar | GROUP → group avatar
  presence?: PresenceStatus;   // DIRECT only — other user's presence
  lastSeenAt?: string;         // DIRECT only — other user's last seen (ISO)
  lastMessage?: {
    body: string;
    senderId: ID;
    createdAt: string;
  };
  unreadCount: number;
  participantIds: ID[];
  isMuted?: boolean;
  isPinned?: boolean;
  updatedAt: string;
}

/** GET /api/chat/messages/{conversationId}?page=1&pageSize=50 */
export interface ConversationMessagesResponse {
  data: Message[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
  participants: User[];        // Full user objects for all participants in this conversation
}

/** POST /api/chat/media — multipart upload response */
export interface MediaUploadResponse {
  attachments: Attachment[];   // Server-stored attachments with URLs ready to embed in a message
}

/** Used by WebSocket /app/chat.send (primary send path) and internal optimistic queue */
export interface SendMessageRequest {
  conversationId: ID;
  body: string;
  attachments?: Attachment[];
  replyToId?: ID;
  clientId: ID;
}

/** Used by WebSocket /app/chat.read */
export interface MarkReadRequest {
  conversationId: ID;
  upToMessageId: ID;
}

// =============================================================================
// Realtime Event Envelopes
// All server -> client events flow through /user/queue/events with `type` discriminator.
// =============================================================================

export type RealtimeEventType =
  | "MESSAGE_NEW"
  | "MESSAGE_UPDATED"
  | "MESSAGE_DELETED"
  | "MESSAGE_ACK"            // server ack of our optimistic send (clientId -> serverId)
  | "MESSAGE_DELIVERED"
  | "MESSAGE_READ"
  | "TYPING_START"
  | "TYPING_STOP"
  | "PRESENCE_UPDATE"
  | "REACTION_ADDED"
  | "REACTION_REMOVED"
  | "CONVERSATION_CREATED"
  | "CONVERSATION_UPDATED"
  | "UNREAD_COUNT_UPDATED";

export interface RealtimeEvent<T = unknown> {
  type: RealtimeEventType;
  ts: string;        // ISO timestamp
  payload: T;
}

// Specific payloads (handy for switch narrowing)
export interface MessageAckPayload {
  clientId: ID;
  message: Message;
}
export interface TypingPayload {
  conversationId: ID;
  userId: ID;
}
export interface PresencePayload {
  userId: ID;
  status: PresenceStatus;
  lastSeenAt?: string;
}
export interface ReadPayload {
  conversationId: ID;
  userId: ID;
  upToMessageId: ID;
  readAt: string;
}
export interface ReactionPayload {
  conversationId: ID;
  messageId: ID;
  emoji: string;
  userId: ID;
}
export interface UnreadCountPayload {
  conversationId: ID;
  unreadCount: number;
}

// =============================================================================
// STOMP-style destinations (kept as constants so we have one source of truth)
// =============================================================================

export const STOMP_DESTINATIONS = {
  // Client -> Server (SEND)
  SEND_MESSAGE: "/app/chat.send",
  TYPING: "/app/chat.typing",
  READ: "/app/chat.read",
  REACTION: "/app/chat.reaction",
  PRESENCE: "/app/presence",

  // Server -> Client (SUBSCRIBE)
  USER_QUEUE_EVENTS: "/user/queue/events",          // primary fan-in for everything
  TOPIC_CONVERSATION: (id: ID) => `/topic/messages/${id}`, // optional per-conversation topic
  TOPIC_PRESENCE: "/topic/presence",
} as const;
