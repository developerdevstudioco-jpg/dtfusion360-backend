// =============================================================================
// Chat REST API Client — Simplified 3-endpoint design.
// Swap between mock and real backend via VITE_CHAT_MODE env variable.
// =============================================================================
import type {
  ContactItem,
  Conversation,
  ConversationMessagesResponse,
  ConversationType,
  ID,
  MediaUploadResponse,
  User,
} from "../types";
import axios from "axios";
import { mockServer } from "../mocks/server";

const FAKE_LATENCY_MS = 250;
const delay = <T>(value: T, ms = FAKE_LATENCY_MS): Promise<T> =>
  new Promise((res) => setTimeout(() => res(value), ms));

const MODE = import.meta.env.VITE_CHAT_MODE || "mock";
const API_BASE = import.meta.env.VITE_API_BASE_URL || "https://dtfusion360-backend.onrender.com";

// REST endpoint constants
export const CHAT_ENDPOINTS = {
  CONTACTS: "/api/chat/contacts",
  MESSAGES: (id: ID) => `/api/chat/messages/${id}`,
  MEDIA: "/api/chat/media",
} as const;

export const chatApi = {
  /**
   * GET /api/chat/contacts
   * Returns the sidebar listing: all direct contacts & groups for the authenticated user.
   * Each item includes name, avatar, presence, lastMessage, unreadCount.
   */
  async getContacts(): Promise<ContactItem[]> {
    if (MODE === "real") {
      const res = await axios.get(`${API_BASE}${CHAT_ENDPOINTS.CONTACTS}`);
      return res.data;
    }
    return delay(mockServer.getContacts());
  },

  /**
   * GET /api/chat/messages/{conversationId}?page=1&pageSize=50
   * Returns paginated messages for a conversation along with full participant details
   * (name, avatar, presence, lastSeenAt) so the chat header can render without extra calls.
   */
  async getMessages(
    conversationId: ID,
    page = 1,
    pageSize = 50,
  ): Promise<ConversationMessagesResponse> {
    if (MODE === "real") {
      const res = await axios.get(
        `${API_BASE}${CHAT_ENDPOINTS.MESSAGES(conversationId)}`,
        { params: { page, pageSize } },
      );
      return res.data;
    }
    return delay(mockServer.getMessages(conversationId, page, pageSize));
  },

  async getUsers(): Promise<User[]> {
    if (MODE === "real") {
      const res = await axios.get(`${API_BASE}/api/chat/users`);
      return res.data;
    }
    return delay(mockServer.listUsers());
  },

  async createConversation(type: ConversationType, participantIds: ID[], title?: string): Promise<Conversation> {
    if (MODE === "real") {
      const res = await axios.post(`${API_BASE}/api/chat/conversations`, {
        type,
        participantIds,
        title,
      });
      return res.data;
    }
    return delay(mockServer.createConversation(type, participantIds, title));
  },

  /**
   * POST /api/chat/media  (multipart/form-data)
   * Uploads media files and returns attachment objects with server URLs.
   * The client then embeds these attachments in a WebSocket message via /app/chat.send.
   */
  async uploadMedia(files: File[]): Promise<MediaUploadResponse> {
    if (MODE === "real") {
      const formData = new FormData();
      files.forEach((file) => formData.append("files", file));
      const res = await axios.post(
        `${API_BASE}${CHAT_ENDPOINTS.MEDIA}`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" } },
      );
      return res.data;
    }
    // Mock: generate fake URLs
    return delay(mockServer.uploadMedia(files));
  },
};
