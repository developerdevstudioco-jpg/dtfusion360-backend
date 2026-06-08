import { useState } from "react";
import { Search } from "lucide-react";
import { ChatProvider } from "../providers/ChatProvider";
import { ConversationList } from "./ConversationList";
import { ChatWindow } from "./ChatWindow";
import { useActiveConversation, useConnectionState } from "../hooks";
import { Badge } from "../../../components/ui/badge";
import { Input } from "../../../components/ui/input";

function ConnectionBadge() {
  const state = useConnectionState();
  const tone =
    state === "CONNECTED"
      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
      : state === "RECONNECTING" || state === "CONNECTING"
        ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
        : "bg-destructive/15 text-destructive";
  return (
    <Badge variant="secondary" className={`text-[10px] ${tone}`}>
      {state}
    </Badge>
  );
}

function ChatModuleInner() {
  const { activeId, setActive } = useActiveConversation();
  const [search, setSearch] = useState("");

  return (
    <div className="flex h-full w-full overflow-hidden rounded-xl border border-border shadow-sm bg-background">
      <aside className="flex flex-col border-r border-border h-full basis-1/3 grow-0 shrink-0 overflow-hidden bg-muted/5 min-h-0">
        <div className="flex h-16 items-center justify-between px-6 border-b border-border/50 shrink-0">
          <h2 className="text-[17px] font-bold text-foreground tracking-tight">Chats</h2>
          <ConnectionBadge />
        </div>
        <div className="px-4 py-3 shrink-0">
          <div className="relative flex items-center">
            <Search className="absolute left-3.5 h-4 w-4 text-muted-foreground shrink-0" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search or start new chat"
              className="h-9 pl-9 bg-muted/40 border-transparent hover:bg-muted/60 focus-visible:ring-1 focus-visible:ring-primary rounded-lg shadow-none text-sm transition-colors"
            />
          </div>
        </div>
        <div className="flex-1 overflow-hidden min-h-0">
          <ConversationList
            search={search}
            onSelect={(id) => setActive(id)}
          />
        </div>
      </aside>

      <section className="flex flex-col min-w-0 h-full flex-1 bg-background min-h-0">
        {activeId ? (
          <ChatWindow conversationId={activeId} />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center bg-muted/5 border-l border-border/10">
            <div className="w-20 h-20 rounded-full bg-muted/50 flex items-center justify-center mb-6 shadow-sm">
               <Search className="h-8 w-8 text-muted-foreground/40" />
            </div>
            <p className="text-xl font-semibold text-foreground/80 tracking-tight">DT-Fusion Messenger</p>
            <p className="mt-2 text-sm text-muted-foreground/80 max-w-[280px] text-center leading-relaxed">
              Select a conversation from the sidebar to view your messages.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

export function ChatModule() {
  return (
    <ChatProvider>
      <ChatModuleInner />
    </ChatProvider>
  );
}
