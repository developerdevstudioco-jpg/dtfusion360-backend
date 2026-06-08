// =============================================================================
// RealStompClient
// Production transport built on @stomp/stompjs. Implements the same surface as
// MockStompClient so it can be swapped in transparently via the factory.
// =============================================================================
import { Client, type StompSubscription, type IFrame } from "@stomp/stompjs";
import type { RealtimeEvent } from "../types";

export type ConnectionState = "DISCONNECTED" | "CONNECTING" | "CONNECTED" | "RECONNECTING";

type EventHandler = (event: RealtimeEvent) => void;
type ConnectionListener = (state: ConnectionState) => void;

interface Subscription {
  id: string;
  destination: string;
  unsubscribe: () => void;
}

const uid = (p: string) => `${p}_${Math.random().toString(36).slice(2, 10)}`;

interface RealStompOptions {
  brokerURL: string;                       // e.g. ws://host/ws or wss://host/ws
  connectHeaders?: Record<string, string>; // e.g. { Authorization: "Bearer ..." }
  reconnectDelay?: number;
  debug?: boolean;
}

class RealStompClient {
  private client: Client | null = null;
  private state: ConnectionState = "DISCONNECTED";
  private connectionListeners = new Set<ConnectionListener>();
  // pending subscriptions (subscribed before CONNECTED) and active ones
  private pending = new Map<string, { destination: string; handler: EventHandler }>();
  private active = new Map<string, { sub: StompSubscription; destination: string }>();

  constructor(private opts: RealStompOptions) {}

  getState() {
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
      const client = new Client({
        brokerURL: this.opts.brokerURL,
        connectHeaders: this.opts.connectHeaders,
        reconnectDelay: this.opts.reconnectDelay ?? 5000,
        heartbeatIncoming: 10000,
        heartbeatOutgoing: 10000,
        debug: this.opts.debug ? (s) => console.log("[stomp]", s) : () => {},
      });

      client.onConnect = () => {
        this.setState("CONNECTED");
        // flush pending subscriptions
        this.pending.forEach((entry, id) => {
          const sub = client.subscribe(entry.destination, (msg) => {
            try {
              entry.handler(JSON.parse(msg.body) as RealtimeEvent);
            } catch (e) {
              console.error("[stomp] failed to parse frame", e);
            }
          });
          this.active.set(id, { sub, destination: entry.destination });
        });
        this.pending.clear();
        resolve();
      };

      client.onWebSocketClose = () => {
        if (this.state === "CONNECTED") this.setState("RECONNECTING");
        // move active subs back to pending so they re-bind on reconnect
        this.active.forEach((entry, id) => {
          this.pending.set(id, { destination: entry.destination, handler: () => {} });
        });
        this.active.clear();
      };

      client.onStompError = (frame: IFrame) => {
        console.error("[stomp] broker error:", frame.headers["message"], frame.body);
      };

      client.activate();
      this.client = client;
    });
  }

  disconnect() {
    this.active.forEach(({ sub }) => sub.unsubscribe());
    this.active.clear();
    this.pending.clear();
    void this.client?.deactivate();
    this.client = null;
    this.setState("DISCONNECTED");
  }

  forceReconnect() {
    this.setState("RECONNECTING");
    void this.client?.deactivate().then(() => {
      this.client?.activate();
    });
  }

  subscribe(destination: string, handler: EventHandler): Subscription {
    const id = uid("sub");

    if (this.client?.connected) {
      const sub = this.client.subscribe(destination, (msg) => {
        try {
          handler(JSON.parse(msg.body) as RealtimeEvent);
        } catch (e) {
          console.error("[stomp] failed to parse frame", e);
        }
      });
      this.active.set(id, { sub, destination });
    } else {
      this.pending.set(id, { destination, handler });
    }

    return {
      id,
      destination,
      unsubscribe: () => {
        const a = this.active.get(id);
        if (a) {
          a.sub.unsubscribe();
          this.active.delete(id);
        }
        this.pending.delete(id);
      },
    };
  }

  send(destination: string, body: unknown) {
    if (!this.client?.connected) {
      console.warn("[stomp] send while disconnected, dropped", destination);
      return;
    }
    this.client.publish({ destination, body: JSON.stringify(body) });
  }
}

export { RealStompClient };
