import { useEffect, useMemo, useRef } from "react";
import type { Attachment, Message } from "../types";
import { useUsers } from "../hooks";
import { CURRENT_USER_ID } from "../mocks/data";
import { cn } from "../../../lib/utils";
import { Check, CheckCheck, AlertCircle, Loader2, Reply, MoreHorizontal, Download, FileText } from "lucide-react";
import { Button } from "../../../components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../../components/ui/dropdown-menu";

interface Props {
  messages: Message[];
  onReact: (messageId: string, emoji: string) => void;
  onRetry: (clientId: string) => void;
  onReply: (m: Message) => void;
}

/* ── Date formatting helper ── */
function formatDateLabel(date: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffMs = today.getTime() - target.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return date.toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function DateDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-4 py-4 select-none">
      <div className="flex-1 h-px bg-border/60" />
      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 bg-[#f8f9fa] dark:bg-[#1a1b1e] px-3 py-1 rounded-full shadow-sm border border-border/30">
        {label}
      </span>
      <div className="flex-1 h-px bg-border/60" />
    </div>
  );
}

function AttachmentPreview({ att, isMe }: { att: Attachment; isMe: boolean }) {
  if (att.kind === "IMAGE") {
    return (
      <a href={att.url} target="_blank" rel="noopener noreferrer" className="block">
        <img
          src={att.thumbnailUrl ?? att.url}
          alt={att.name}
          className="rounded-lg max-w-[260px] max-h-[200px] object-cover cursor-pointer hover:opacity-90 transition-opacity border border-border/10"
        />
      </a>
    );
  }
  if (att.kind === "VIDEO") {
    return (
      <video
        src={att.url}
        controls
        className="rounded-lg max-w-[300px] max-h-[220px] border border-border/10"
      />
    );
  }
  // FILE / AUDIO
  return (
    <a
      href={att.url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs transition-colors",
        isMe
          ? "bg-primary-foreground/10 hover:bg-primary-foreground/20 text-primary-foreground"
          : "bg-muted/50 hover:bg-muted/80 text-foreground"
      )}
    >
      <FileText className="h-5 w-5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{att.name}</p>
        <p className="opacity-70">{(att.size / 1024).toFixed(1)} KB</p>
      </div>
      <Download className="h-4 w-4 shrink-0 opacity-60" />
    </a>
  );
}

function StatusIcon({ m }: { m: Message }) {
  if (m.senderId !== CURRENT_USER_ID) return null;
  if (m.status === "PENDING")
    return <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />;
  if (m.status === "FAILED") return <AlertCircle className="h-3 w-3 text-destructive" />;
  if (m.status === "READ") return <CheckCheck className="h-3 w-3 text-primary" />;
  if (m.status === "DELIVERED") return <CheckCheck className="h-3 w-3 text-muted-foreground" />;
  return <Check className="h-3 w-3 text-muted-foreground" />;
}

export function MessageList({ messages, onReact, onRetry, onReply }: Props) {
  const users = useUsers();
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  /* ── Group by sender, but also track day boundaries ── */
  const grouped = useMemo(() => {
    return messages.reduce<{ senderId: string; items: Message[] }[]>((acc, m) => {
      const last = acc[acc.length - 1];
      if (last && last.senderId === m.senderId) last.items.push(m);
      else acc.push({ senderId: m.senderId, items: [m] });
      return acc;
    }, []);
  }, [messages]);

  /* ── Track which date labels we've already rendered ── */
  let lastDateKey = "";

  return (
    <div className="flex flex-col gap-1 p-5">
      {grouped.map((group, gi) => {
        const isMe = group.senderId === CURRENT_USER_ID;
        const sender = users[group.senderId];

        // Determine if we need a date divider before this group
        const firstMsgDate = new Date(group.items[0].createdAt);
        const dateKey = `${firstMsgDate.getFullYear()}-${firstMsgDate.getMonth()}-${firstMsgDate.getDate()}`;
        let showDateDivider = false;
        if (dateKey !== lastDateKey) {
          showDateDivider = true;
          lastDateKey = dateKey;
        }

        return (
          <div key={gi}>
            {showDateDivider && (
              <DateDivider label={formatDateLabel(firstMsgDate)} />
            )}
            <div className={cn("flex flex-col gap-1.5 mb-5", isMe ? "items-end" : "items-start")}>
              {!isMe && (
                <span className="px-2 text-[12px] font-semibold tracking-wide text-muted-foreground/80 mb-1 ml-1">
                  {sender?.name ?? "Unknown"}
                </span>
              )}
              {group.items.map((m, mi) => {
                const isFirst = mi === 0;
                const isLast = mi === group.items.length - 1;
                return (
                <div
                  key={m.id}
                  className={cn(
                    "group relative max-w-[75%] px-4 py-2.5 text-[14.5px] leading-relaxed transition-all shadow-sm",
                    isMe
                      ? "bg-primary text-primary-foreground"
                      : "bg-white dark:bg-[#202c33] text-foreground border border-border/20",
                    "rounded-2xl",
                    isMe && isFirst ? "rounded-tr-sm" : "",
                    isMe && isLast ? "rounded-br-sm" : "",
                    isMe && !isFirst && !isLast ? "rounded-r-sm" : "",
                    !isMe && isFirst ? "rounded-tl-sm" : "",
                    !isMe && isLast ? "rounded-bl-sm" : "",
                    !isMe && !isFirst && !isLast ? "rounded-l-sm" : "",
                    m.status === "FAILED" && "ring-1 ring-destructive",
                  )}
                >
                  {/* Reply context */}
                  {m.replyToId && (
                    <div className={cn(
                      "mb-1.5 flex flex-col gap-0.5 rounded-md border-l-2 pl-2 text-xs",
                      isMe ? "border-primary-foreground/50 bg-primary-foreground/10" : "border-foreground/30 bg-background/50 text-muted-foreground"
                    )}>
                      <span className="font-semibold opacity-80">
                        {messages.find(x => x.id === m.replyToId)?.senderId === CURRENT_USER_ID ? 'You' : (users[messages.find(x => x.id === m.replyToId)?.senderId ?? '']?.name ?? 'Someone')}
                      </span>
                      <span className="truncate opacity-90">{messages.find(x => x.id === m.replyToId)?.body ?? "Message deleted or unavailable"}</span>
                    </div>
                  )}
                  {m.body && <p className="whitespace-pre-wrap break-words">{m.body}</p>}
                  {/* Attachments */}
                  {m.attachments && m.attachments.length > 0 && (
                    <div className="mt-1.5 flex flex-col gap-1.5">
                      {m.attachments.map((att) => (
                        <AttachmentPreview key={att.id} att={att} isMe={isMe} />
                      ))}
                    </div>
                  )}
                  {/* Options Menu (Dropdown) */}
                  <div
                    className={cn(
                      "absolute top-2 opacity-0 transition-opacity group-hover:opacity-100",
                      isMe ? "left-2" : "right-2",
                    )}
                  >
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="flex h-6 w-6 items-center justify-center rounded-full bg-background/90 border border-border shadow-sm text-foreground hover:bg-accent backdrop-blur transition-colors">
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align={isMe ? "start" : "end"} side="bottom">
                        <DropdownMenuItem onClick={() => onReply(m)} className="cursor-pointer">
                          <Reply className="mr-2 h-4 w-4" />
                          <span>Reply</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  
                  {m.reactions.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {m.reactions.map((r) => (
                        <button
                          key={r.emoji}
                          type="button"
                          onClick={() => onReact(m.id, r.emoji)}
                          className="rounded-full bg-background/80 px-1.5 py-0.5 text-xs text-foreground shadow-sm hover:bg-background"
                        >
                          {r.emoji} {r.userIds.length}
                        </button>
                      ))}
                    </div>
                  )}
                  <div
                    className={cn(
                      "mt-0.5 flex items-center justify-end gap-1 text-[10.5px]",
                      isMe ? "text-primary-foreground/70" : "text-muted-foreground/80",
                    )}
                  >
                    <span>
                      {new Date(m.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    <StatusIcon m={m} />
                  </div>

                  {m.status === "FAILED" && m.clientId && (
                    <Button
                      size="sm"
                      variant="destructive"
                      className="mt-2 h-6 px-2 text-[10px]"
                      onClick={() => onRetry(m.clientId!)}
                    >
                      Retry send
                    </Button>
                  )}
                </div>
                );
              })}
            </div>
          </div>
        );
      })}
      <div ref={endRef} />
    </div>
  );
}
