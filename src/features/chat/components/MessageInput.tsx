import { useEffect, useRef, useState } from "react";
import { Button } from "../../../components/ui/button";
import { Textarea } from "../../../components/ui/textarea";
import { Send, Paperclip, X, Image, FileText, Film, Loader2 } from "lucide-react";
import type { Attachment, Message } from "../types";

interface Props {
  onSend: (body: string, attachments?: Attachment[]) => void;
  onTyping: (typing: boolean) => void;
  onUploadMedia?: (files: File[]) => Promise<Attachment[]>;
  disabled?: boolean;
  replyTo?: Message | null;
  onCancelReply?: () => void;
}

function FilePreviewIcon({ file }: { file: File }) {
  if (file.type.startsWith("image/")) return <Image className="h-4 w-4 text-blue-500" />;
  if (file.type.startsWith("video/")) return <Film className="h-4 w-4 text-purple-500" />;
  return <FileText className="h-4 w-4 text-amber-500" />;
}

export function MessageInput({ onSend, onTyping, onUploadMedia, disabled, replyTo, onCancelReply }: Props) {
  const [value, setValue] = useState("");
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);

  useEffect(() => {
    return () => {
      if (typingTimer.current) clearTimeout(typingTimer.current);
      if (isTypingRef.current) onTyping(false);
    };
  }, [onTyping]);

  const submit = async () => {
    const trimmed = value.trim();
    if (!trimmed && stagedFiles.length === 0) return;

    let attachments: Attachment[] = [];

    // Upload staged files first
    if (stagedFiles.length > 0 && onUploadMedia) {
      setUploading(true);
      try {
        attachments = await onUploadMedia(stagedFiles);
      } catch (err) {
        console.error("Media upload failed:", err);
        setUploading(false);
        return;
      }
      setUploading(false);
    }

    onSend(trimmed || "📎", attachments.length > 0 ? attachments : undefined);
    setValue("");
    setStagedFiles([]);
    if (isTypingRef.current) {
      onTyping(false);
      isTypingRef.current = false;
    }
  };

  const handleChange = (next: string) => {
    setValue(next);
    if (!isTypingRef.current && next) {
      onTyping(true);
      isTypingRef.current = true;
    }
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      if (isTypingRef.current) {
        onTyping(false);
        isTypingRef.current = false;
      }
    }, 1500);
  };

  const handleFilePick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) {
      setStagedFiles((prev) => [...prev, ...files]);
    }
    // Reset input so the same file can be re-selected
    e.target.value = "";
  };

  const removeFile = (index: number) => {
    setStagedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const canSend = !disabled && !uploading && (value.trim().length > 0 || stagedFiles.length > 0);

  return (
    <div className="bg-background p-3 border-t border-border/50 shrink-0">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar"
        onChange={handleFileChange}
        className="hidden"
      />

      <div className="flex flex-col bg-muted/40 border border-border/30 rounded-3xl overflow-hidden shadow-sm transition-all focus-within:ring-1 focus-within:ring-primary focus-within:bg-background">
        {/* Reply preview */}
        {replyTo && (
          <div className="flex items-center justify-between bg-muted/20 px-5 py-2 text-xs border-b border-border/30">
            <div className="flex flex-col border-l-2 border-primary pl-3 overflow-hidden">
              <span className="font-semibold text-primary">Replying to</span>
              <span className="truncate text-muted-foreground">{replyTo.body}</span>
            </div>
            <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 rounded-full hover:bg-muted" onClick={onCancelReply}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}

        {/* Staged file previews */}
        {stagedFiles.length > 0 && (
          <div className="flex flex-wrap gap-2 px-4 pt-3 pb-1 border-b border-border/20">
            {stagedFiles.map((file, i) => (
              <div key={i} className="group relative flex items-center gap-2 bg-muted/60 rounded-lg px-3 py-1.5 text-xs border border-border/30">
                {file.type.startsWith("image/") ? (
                  <img
                    src={URL.createObjectURL(file)}
                    alt={file.name}
                    className="h-10 w-10 rounded object-cover"
                  />
                ) : (
                  <FilePreviewIcon file={file} />
                )}
                <span className="truncate max-w-[120px] text-foreground/80">{file.name}</span>
                <button
                  type="button"
                  onClick={() => removeFile(i)}
                  className="ml-1 h-5 w-5 flex items-center justify-center rounded-full bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Input row */}
        <div className="flex items-end gap-2 px-2 py-1.5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleFilePick}
            disabled={disabled || uploading}
            className="shrink-0 h-10 w-10 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            <Paperclip className="h-5 w-5" />
          </Button>
          <Textarea
            value={value}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void submit();
              }
            }}
            disabled={disabled || uploading}
            placeholder={uploading ? "Uploading..." : disabled ? "Connecting..." : "Type a message"}
            className="min-h-[40px] max-h-[160px] resize-none border-0 bg-transparent px-1 py-2.5 text-[15px] focus-visible:ring-0 shadow-none placeholder:text-muted-foreground/60 scrollbar-none"
            rows={1}
          />
          <Button
            type="button"
            onClick={() => void submit()}
            disabled={!canSend}
            size="icon"
            className="shrink-0 h-10 w-10 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm transition-transform active:scale-95 disabled:opacity-50"
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 ml-0.5" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
