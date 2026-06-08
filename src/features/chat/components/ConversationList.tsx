import { useMemo } from "react";
import { useConversations, useUsers } from "../hooks";
import type { Conversation } from "../types";
import { Avatar, AvatarFallback, AvatarImage } from "../../../components/ui/avatar";
import { Badge } from "../../../components/ui/badge";
import { ScrollArea } from "../../../components/ui/scroll-area";
import { cn } from "../../../lib/utils";
import { CURRENT_USER_ID } from "../mocks/data";

interface Props {
  onSelect: (id: string) => void;
  search?: string;
}

function formatTime(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

export function ConversationList({ onSelect, search = "" }: Props) {
  const { conversations, loading, activeId } = useConversations();
  const users = useUsers();

  const items = useMemo(
    () => {
      const q = search.trim().toLowerCase();
      return conversations
        .map((c) => {
          const otherId = c.participantIds.find((id) => id !== CURRENT_USER_ID);
          const other = otherId ? users[otherId] : undefined;
          const title = c.type === "GROUP" ? c.title ?? "Group" : other?.name ?? "Direct";
          const presence = other?.presence;
          return { conv: c, title, presence, avatarUrl: other?.avatarUrl };
        })
        .filter(({ title }) => !q || title.toLowerCase().includes(q));
    },
    [conversations, users, search],
  );

  if (loading && items.length === 0) {
    return <div className="p-4 text-sm text-muted-foreground">Loading conversations…</div>;
  }

  return (
    <ScrollArea className="h-full">
      <ul className="space-y-[1px] py-2">
        {items.map(({ conv, title, presence, avatarUrl }) => (
          <li key={conv.id}>
            <button
              type="button"
              onClick={() => onSelect(conv.id)}
              className={cn(
                "flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors border-l-4",
                activeId === conv.id 
                  ? "bg-accent border-primary" 
                  : "border-transparent hover:bg-muted/40"
              )}
            >
              <div className="relative">
                <Avatar className="h-12 w-12 shadow-sm border border-border/20">
                  <AvatarImage src={avatarUrl} alt={title} />
                  <AvatarFallback className="bg-primary/5 text-primary font-semibold">{title.slice(0, 1).toUpperCase()}</AvatarFallback>
                </Avatar>
                {presence === "ONLINE" && (
                  <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-background" />
                )}
                {presence === "AWAY" && (
                  <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-amber-500 ring-2 ring-background" />
                )}
              </div>
              <div className="min-w-0 flex-1 pr-1">
                <div className="flex items-center justify-between gap-2">
                  <p className={cn("truncate text-[15px] font-semibold", activeId === conv.id ? "text-foreground" : "text-foreground/80")}>{title}</p>
                  <span className={cn("shrink-0 text-[11px] font-medium", activeId === conv.id ? "text-foreground/60" : "text-muted-foreground/70")}>
                    {formatTime(conv.lastMessage?.createdAt)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 mt-0.5">
                  <p className={cn(
                    "truncate text-[13px]", 
                    conv.unreadCount > 0 ? "text-foreground font-medium" : "text-muted-foreground"
                  )}>
                    {conv.lastMessage?.body ?? "No messages yet"}
                  </p>
                  {conv.unreadCount > 0 && (
                    <Badge className="h-5 min-w-5 justify-center px-1.5 text-[10px] rounded-full bg-primary text-primary-foreground border-none shadow-sm">
                      {conv.unreadCount}
                    </Badge>
                  )}
                </div>
              </div>
            </button>
          </li>
        ))}
        {items.length === 0 && (
          <li className="px-4 py-8 text-center text-sm text-muted-foreground">
            No conversations
          </li>
        )}
      </ul>
    </ScrollArea>
  );
}

// Re-export for callers that want the type
export type { Conversation };
