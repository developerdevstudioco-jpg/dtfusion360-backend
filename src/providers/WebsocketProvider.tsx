/**
 * Global WebSocketProvider
 * ----------------------------------------------------------------------------
 * Generic STOMP context for the whole app (notifications, chat-adjacent
 * features, presence, broadcast, etc). Mirrors the reference implementation:
 *   - subscribe(destination, cb) -> Subscription
 *   - publish(destination, body)
 *
 * Uses the same transport factory as the chat module, so flipping
 * VITE_CHAT_MODE between "mock" and "real" controls every WS feature.
 */
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { chatTransport, type ConnectionState } from "../features/chat/transport";
import type { RealtimeEvent } from "../features/chat/types";

interface Subscription {
  id: string;
  destination: string;
  unsubscribe: () => void;
}

interface WebSocketContextValue {
  connection: ConnectionState;
  subscribe: (destination: string, callback: (event: RealtimeEvent) => void) => Subscription | null;
  publish: (destination: string, body: unknown) => void;
}

const WebSocketContext = createContext<WebSocketContextValue | null>(null);

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const [connection, setConnection] = useState<ConnectionState>("DISCONNECTED");

  useEffect(() => {
    const off = chatTransport.onConnectionChange(setConnection);
    void chatTransport.connect();
    return () => {
      off();
      // Do NOT disconnect on unmount in dev StrictMode; transport is a singleton.
    };
  }, []);

  const value = useMemo<WebSocketContextValue>(
    () => ({
      connection,
      subscribe: (destination, callback) => {
        return chatTransport.subscribe(destination, callback);
      },
      publish: (destination, body) => chatTransport.send(destination, body),
    }),
    [connection],
  );

  return <WebSocketContext.Provider value={value}>{children}</WebSocketContext.Provider>;
}

export function useWebSocket() {
  const ctx = useContext(WebSocketContext);
  if (!ctx) throw new Error("useWebSocket must be used within <WebSocketProvider>");
  return ctx;
}
