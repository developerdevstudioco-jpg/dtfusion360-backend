// =============================================================================
// Transport factory
// Switches between mock and real STOMP transport via env:
//   VITE_CHAT_MODE = "mock" (default) | "real"
//   VITE_CHAT_WS_URL = ws://host/ws (used when mode=real)
//
// Callers import `chatTransport` and never need to care which one is active.
// =============================================================================
import { mockTransport } from "./mockClient";
import { RealStompClient } from "./realStompClient";

export type { ConnectionState } from "./mockClient";

const MODE = (import.meta.env.VITE_CHAT_MODE ?? "mock") as "mock" | "real";
const WS_URL = import.meta.env.VITE_CHAT_WS_URL ?? "wss://dtfusion360-backend.onrender.com/ws";

function buildTransport() {
  if (MODE === "real") {
    console.info("[chat] transport = REAL STOMP", WS_URL);
    return new RealStompClient({
      brokerURL: WS_URL,
      reconnectDelay: 5000,
      debug: import.meta.env.DEV,
    });
  }
  console.info("[chat] transport = MOCK");
  return mockTransport;
}

export const chatTransport = buildTransport();
export const CHAT_MODE = MODE;
