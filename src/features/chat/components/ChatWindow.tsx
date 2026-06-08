import { useEffect, useState } from "react";
import { useChatContext } from "../providers/ChatProvider";
import { useConversation, useUsers } from "../hooks";
import { CURRENT_USER_ID } from "../mocks/data";
import { MessageList } from "./MessageList";
import { MessageInput } from "./MessageInput";
import { TypingIndicator } from "./TypingIndicator";
import { Avatar, AvatarFallback, AvatarImage } from "../../../components/ui/avatar";
import { Badge } from "../../../components/ui/badge";
import type { Attachment, Message } from "../types";
import { chatApi } from "../api/chatApi";

interface Props {
  conversationId: string;
}

export function ChatWindow({ conversationId }: Props) {
  const { conversation, messages, loading, typingUserIds } = useConversation(conversationId);
  const users = useUsers();
  const { sendMessage, setTyping, markRead, toggleReaction, resendFailed, connection } =
    useChatContext();
  const [replyTo, setReplyTo] = useState<Message | null>(null);

  // Mark the latest visible message as read when it changes
  useEffect(() => {
    if (!conversation || messages.length === 0) return;
    const last = messages[messages.length - 1];
    if (last.senderId !== CURRENT_USER_ID) {
      markRead(conversation.id, last.id);
    }
  }, [conversation, messages, markRead]);

  if (!conversation) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Conversation not found
      </div>
    );
  }

  const otherId = conversation.participantIds.find((id) => id !== CURRENT_USER_ID);
  const other = otherId ? users[otherId] : undefined;
  const title =
    conversation.type === "GROUP" ? conversation.title ?? "Group" : other?.name ?? "Direct";
  const presence = other?.presence;

  return (
    <div className="flex h-full flex-col bg-background min-h-0 relative">
      <header className="flex h-16 items-center gap-4 px-6 border-b border-border/50 bg-background/95 backdrop-blur shrink-0 z-10">
        <Avatar className="h-10 w-10 border border-border/50">
          <AvatarImage src={other?.avatarUrl} alt={title} />
          <AvatarFallback className="bg-primary/5 text-primary font-semibold">{title.slice(0, 1).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[16px] font-bold text-foreground leading-tight">{title}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            {presence === "ONLINE" ? (
                <span className="text-[12px] font-medium text-emerald-600 dark:text-emerald-400">Online</span>
            ) : presence === "AWAY" ? (
                <span className="text-[12px] font-medium text-amber-600 dark:text-amber-400">Away</span>
            ) : (
                <span className="text-[12px] text-muted-foreground">
                {conversation.type === "GROUP"
                ? `${conversation.participantIds.length} members`
                : other?.lastSeenAt
                    ? `Last seen ${new Date(other.lastSeenAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                    : "Offline"}
                </span>
            )}
          </div>
        </div>
        {connection !== "CONNECTED" && (
          <Badge variant="secondary" className="text-[10px] bg-amber-500/10 text-amber-500 border-amber-500/20">
            {connection}
          </Badge>
        )}
      </header>

      <div className="flex-1 overflow-y-auto min-h-0 bg-[#f8f9fa] dark:bg-[#1a1b1e]">
        {loading && messages.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">Loading messages…</div>
        ) : (
          <MessageList
            messages={messages}
            onReact={(messageId, emoji) => toggleReaction(conversation.id, messageId, emoji)}
            onRetry={(clientId) => resendFailed(clientId)}
            onReply={(msg) => setReplyTo(msg)}
          />
        )}
      </div>

      <TypingIndicator userIds={typingUserIds} />
      <MessageInput
        disabled={connection !== "CONNECTED"}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
        onUploadMedia={async (files: File[]) => {
          const resp = await chatApi.uploadMedia(files);
          return resp.attachments;
        }}
        onSend={(body, attachments?: Attachment[]) => {
          sendMessage({ conversationId: conversation.id, body, replyToId: replyTo?.id, attachments });
          setReplyTo(null);
        }}
        onTyping={(t) => setTyping(conversation.id, t)}
      />
    </div>
  );
}
