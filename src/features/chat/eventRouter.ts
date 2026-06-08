// =============================================================================
// Event router: turns realtime envelopes from /user/queue/events into
// granular Redux actions. Single source of truth for event -> reducer mapping.
// =============================================================================
import type { AppDispatch } from "../../store/store";
import {
  eventConversationCreated,
  eventMessageAck,
  eventMessageDelivered,
  eventMessageNew,
  eventMessageRead,
  eventPresence,
  eventReaction,
  eventTyping,
  eventUnreadCountUpdated,
} from "./chatSlice";
import type {
  Conversation,
  Message,
  MessageAckPayload,
  PresencePayload,
  ReactionPayload,
  ReadPayload,
  RealtimeEvent,
  TypingPayload,
  UnreadCountPayload,
} from "./types";

export function dispatchRealtimeEvent(dispatch: AppDispatch, event: RealtimeEvent) {
  switch (event.type) {
    case "MESSAGE_NEW":
      dispatch(eventMessageNew(event.payload as Message));
      break;
    case "MESSAGE_ACK":
      dispatch(eventMessageAck(event.payload as MessageAckPayload));
      break;
    case "MESSAGE_DELIVERED":
      dispatch(
        eventMessageDelivered(
          event.payload as { messageId: string; conversationId: string; userIds: string[] },
        ),
      );
      break;
    case "MESSAGE_READ":
      dispatch(eventMessageRead(event.payload as ReadPayload));
      break;
    case "TYPING_START":
      dispatch(eventTyping({ ...(event.payload as TypingPayload), typing: true }));
      break;
    case "TYPING_STOP":
      dispatch(eventTyping({ ...(event.payload as TypingPayload), typing: false }));
      break;
    case "PRESENCE_UPDATE":
      dispatch(eventPresence(event.payload as PresencePayload));
      break;
    case "REACTION_ADDED":
      dispatch(eventReaction({ ...(event.payload as ReactionPayload), kind: "ADDED" }));
      break;
    case "REACTION_REMOVED":
      dispatch(eventReaction({ ...(event.payload as ReactionPayload), kind: "REMOVED" }));
      break;
    case "CONVERSATION_CREATED":
      dispatch(eventConversationCreated(event.payload as Conversation));
      break;
    case "UNREAD_COUNT_UPDATED":
      dispatch(eventUnreadCountUpdated(event.payload as UnreadCountPayload));
      break;
    default:
      // unknown event types are intentionally ignored (forward-compatible)
      break;
  }
}
