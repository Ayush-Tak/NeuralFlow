"use client";

import { useState } from "react";
import Sidebar from "@/components/layout/Sidebar";
import TopBar from "@/components/layout/TopBar";
import ChatInterface from "@/components/chat/ChatInterface";

export default function ChatPage() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="app-layout">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      <main className={`app-main ${sidebarCollapsed ? "app-main--collapsed" : ""}`}>
        <TopBar collapsed={sidebarCollapsed} />
        <ChatInterface />
      </main>
    </div>
  );
}
