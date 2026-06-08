import Layout from "../../components/Layout";
import { ChatModule } from "./components/ChatModule";
import type { User, Page } from "../../types";

interface ChatPageProps {
  user: User;
  onNavigate: (page: Page) => void;
  onLogout: () => void;
}

export default function ChatPage({ user, onNavigate, onLogout }: ChatPageProps) {
  return (
    <Layout
      user={user}
      currentPage="chat"
      onNavigate={onNavigate}
      onLogout={onLogout}
      title="Chat"
    >
      <div className="w-full" style={{ height: 'calc(100vh - 130px)', minHeight: '500px' }}>
        <ChatModule />
      </div>
    </Layout>
  );
}
