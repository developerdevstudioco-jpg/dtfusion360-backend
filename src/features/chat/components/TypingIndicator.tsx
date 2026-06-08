import { useUsers } from "../hooks";
import { CURRENT_USER_ID } from "../mocks/data";

export function TypingIndicator({ userIds }: { userIds: string[] }) {
  const users = useUsers();
  const others = userIds.filter((id) => id !== CURRENT_USER_ID);
  if (others.length === 0) return null;
  const names = others.map((id) => users[id]?.name ?? "Someone").join(", ");
  return (
    <div className="flex items-center gap-2 px-4 py-1 text-xs text-muted-foreground">
      <span className="flex gap-0.5">
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground" />
      </span>
      <span>{names} {others.length === 1 ? "is" : "are"} typing…</span>
    </div>
  );
}
