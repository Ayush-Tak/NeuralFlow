"use client";

import { useState, useEffect } from "react";
import Sidebar from "@/components/layout/Sidebar";
import TopBar from "@/components/layout/TopBar";
import DashboardContent from "@/components/dashboard/DashboardContent";
import { useAuthStore } from "@/hooks/useAuthStore";
import Link from "next/link";
import { Button } from "@/components/ui";
import LandingPage from "@/components/landing/LandingPage";

export default function DashboardPage() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { token, fetchUser } = useAuthStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Refresh user data on mount — picks up token changes after OAuth connect redirects
    if (token) fetchUser();
  }, []);

  if (!mounted) return null;

  if (!token) {
    return <LandingPage />;
  }

  return (
    <div className="app-layout">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      <main className={`app-main ${sidebarCollapsed ? "app-main--collapsed" : ""}`}>
        <TopBar collapsed={sidebarCollapsed} />
        <div className="app-content">
          <DashboardContent />
        </div>
      </main>
    </div>
  );
}
