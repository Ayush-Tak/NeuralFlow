"use client";

import { useState } from "react";
import Sidebar from "@/components/layout/Sidebar";
import FlowEditor from "@/components/flow/FlowEditor";

export default function FlowEditorPage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = params;
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);

  return (
    <div className="app-layout">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      <main className={`app-main ${sidebarCollapsed ? "app-main--collapsed" : ""}`}>
        <FlowEditor flowId={id} sidebarCollapsed={sidebarCollapsed} />
      </main>
    </div>
  );
}
