// =============================================================================
// MockStompClient
// Thin abstraction over the mock server that mimics a STOMP/SockJS client API:
//   - connect()/disconnect()
//   - subscribe(destination, handler) -> Subscription
//   - send(destination, body)
//   - onConnectionChange(cb)
//
// Real backend swap: replace this file with a @stomp/stompjs based implementation
// keeping the same exported `chatTransport` interface. No callers need to change.
// =============================================================================
import type { ID, RealtimeEvent, SendMessageRequest } from "../types";
import { STOMP_DESTINATIONS } from "../types";
import { mockServer } from "../mocks/server";
import { CURRENT_USER_ID } from "../mocks/data";

export type ConnectionState = "DISCONNECTED" | "CONNECTING" | "CONNECTED" | "RECONNECTING";

type EventHandler = (event: RealtimeEvent) => void;
type ConnectionListener = (state: ConnectionState) => void;

interface Subscription {
  id: string;
  destination: string;
  unsubscribe: () => void;
}

const uid = (p: string) => `${p}_${Math.random().toString(36).slice(2, 10)}`;

class MockStompClient {
  private state: ConnectionState = "DISCONNECTED";
  private connectionListeners = new Set<ConnectionListener>();
  private subscriptions = new Map<string, { destination: string; handler: EventHandler }>();
  private serverUnsubscribe: (() => void) | null = null;
  private heartbeat: ReturnType<typeof setInterval> | null = null;
  private reconnectAttempts = 0;

  getState(): ConnectionState {
    return this.state;
  }

  onConnectionChange(cb: ConnectionListener): () => void {
    this.connectionListeners.add(cb);
    cb(this.state);
    return () => this.connectionListeners.delete(cb);
  }

  private setState(next: ConnectionState) {
    this.state = next;
    this.connectionListeners.forEach((l) => l(next));
  }

  connect(): Promise<void> {
    if (this.state === "CONNECTED" || this.state === "CONNECTING") return Promise.resolve();
    this.setState("CONNECTING");
    return new Promise((resolve) => {
      setTimeout(() => {
        this.serverUnsubscribe = mockServer.subscribe((event) => this.routeIncoming(event));
        this.setState("CONNECTED");
        this.reconnectAttempts = 0;
        // Heartbeat (mimic STOMP keepalive)
        this.heartbeat = setInterval(() => {
          // Real client would send a heartbeat frame here; for the mock we no-op.
        }, 20000);
        // Tell server we're online
        mockServer.setPresence(CURRENT_USER_ID, "ONLINE");
        mockServer.startSimulation();
        resolve();
      }, 350);
    });
  }

  disconnect() {
    if (this.heartbeat) {
      clearInterval(this.heartbeat);
      this.heartbeat = null;
    }
    this.serverUnsubscribe?.();
    this.serverUnsubscribe = null;
    mockServer.setPresence(CURRENT_USER_ID, "OFFLINE");
    mockServer.stopSimulation();
    this.setState("DISCONNECTED");
  }

  /** Force a reconnection cycle (for testing UI states). */
  forceReconnect() {
    this.setState("RECONNECTING");
    this.disconnect();
    this.reconnectAttempts += 1;
    const backoff = Math.min(8000, 500 * 2 ** this.reconnectAttempts);
    setTimeout(() => this.connect(), backoff);
  }

  // -- pub/sub -----------------------------------------------------
  subscribe(destination: string, handler: EventHandler): Subscription {
    const id = uid("sub");
    this.subscriptions.set(id, { destination, handler });
    return {
      id,
      destination,
      unsubscribe: () => {
        this.subscriptions.delete(id);
      },
    };
  }

  /** Route an incoming server event to all subscribers whose destination matches. */
  private routeIncoming(event: RealtimeEvent) {
    this.subscriptions.forEach(({ destination, handler }) => {
      if (this.destinationMatches(destination, event)) handler(event);
    });
  }

  private destinationMatches(destination: string, event: RealtimeEvent): boolean {
    // /user/queue/events fans in EVERYTHING (the primary channel).
    if (destination === STOMP_DESTINATIONS.USER_QUEUE_EVENTS) return true;

    // /topic/messages/{conversationId} only delivers conversation-scoped events.
    if (destination.startsWith("/topic/messages/")) {
      const convId = destination.split("/topic/messages/")[1];
      const payload = event.payload as { conversationId?: ID } | undefined;
      return payload?.conversationId === convId;
    }

    // /topic/presence delivers presence updates only.
    if (destination === STOMP_DESTINATIONS.TOPIC_PRESENCE) {
      return event.type === "PRESENCE_UPDATE";
    }

    return false;
  }

  // -- send (client -> server) -------------------------------------
  send(destination: string, body: unknown) {
    if (this.state !== "CONNECTED") {
      console.warn("[stomp] send while disconnected, dropped", destination, body);
      return;
    }

    switch (destination) {
      case STOMP_DESTINATIONS.SEND_MESSAGE: {
        const req = body as SendMessageRequest;
        mockServer.sendMessage(req);
        break;
      }
      case STOMP_DESTINATIONS.TYPING: {
        const { conversationId, typing } = body as { conversationId: ID; typing: boolean };
        mockServer.setTyping(conversationId, CURRENT_USER_ID, typing);
        break;
      }
      case STOMP_DESTINATIONS.READ: {
        const { conversationId, upToMessageId } = body as {
          conversationId: ID;
          upToMessageId: ID;
        };
        mockServer.markRead(conversationId, CURRENT_USER_ID, upToMessageId);
        break;
      }
      case STOMP_DESTINATIONS.REACTION: {
        const { conversationId, messageId, emoji } = body as {
          conversationId: ID;
          messageId: ID;
          emoji: string;
        };
        mockServer.toggleReaction(conversationId, messageId, emoji, CURRENT_USER_ID);
        break;
      }
      case STOMP_DESTINATIONS.PRESENCE: {
        const { status } = body as { status: "ONLINE" | "AWAY" | "OFFLINE" };
        mockServer.setPresence(CURRENT_USER_ID, status);
        break;
      }
      default:
        console.warn("[stomp] unknown destination", destination);
    }
  }
}

export const chatTransport = new MockStompClient();
