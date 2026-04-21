"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, LogOut, Settings2, X } from "lucide-react";
import { useAuthStore } from "@/hooks/useAuthStore";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import styles from "./TopBar.module.css";

interface TopBarProps {
  collapsed: boolean;
}

export default function TopBar({ collapsed }: TopBarProps) {
  const { user, token, logout } = useAuthStore();
  const [greeting, setGreeting] = useState("Good day");
  const [profileOpen, setProfileOpen] = useState(false);
  const [integrationsOpen, setIntegrationsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setGreeting(getGreeting());
    setMounted(true);
  }, []);

  // Close profile dropdown when clicking outside
  useEffect(() => {
    if (!profileOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-profile-menu]")) {
        setProfileOpen(false);
      }
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [profileOpen]);

  return (
    <>
      <motion.header
        className={styles.topbar}
        style={{ left: collapsed ? 72 : 260 }}
        animate={{ left: collapsed ? 72 : 260 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className={styles.left}>
          <div>
            <motion.h1
              className={styles.greeting}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              {greeting} 👋
            </motion.h1>
            <p className={styles.subtitle}>Here&apos;s what&apos;s happening today</p>
          </div>
        </div>

        <div className={styles.right}>
          <Link href="/flows/new" passHref legacyBehavior>
            <motion.button
              className={styles.iconBtn}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              aria-label="Create new flow"
              id="btn-new-flow"
            >
              <Plus size={18} />
            </motion.button>
          </Link>

          {/* Avatar */}
          {user ? (
            <div style={{ position: "relative" }} data-profile-menu>
              <motion.div
                className={styles.avatar}
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.95 }}
                title={user.name || user.email}
                onClick={() => setProfileOpen(!profileOpen)}
                style={{ cursor: "pointer" }}
              >
                {user.avatar_url ? (
                  <img src={user.avatar_url} alt="Profile" style={{ width: "100%", height: "100%", borderRadius: "50%" }} />
                ) : (
                  <span className={styles.avatarText}>{user.name ? user.name[0].toUpperCase() : user.email[0].toUpperCase()}</span>
                )}
              </motion.div>

              <AnimatePresence>
                {profileOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    style={{
                      position: "absolute",
                      top: "calc(100% + 10px)",
                      right: 0,
                      width: "220px",
                      background: "var(--surface-2)",
                      border: "1px solid var(--border-default)",
                      borderRadius: "12px",
                      padding: "8px",
                      boxShadow: "0 10px 40px rgba(0,0,0,0.5)",
                      zIndex: 100,
                    }}
                  >
                    <div style={{ padding: "8px 12px", borderBottom: "1px solid var(--border-default)", marginBottom: "8px" }}>
                      <div style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: "0.9rem" }}>{user.name || "User"}</div>
                      <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>{user.email}</div>
                    </div>
                    <button
                      onClick={() => { setProfileOpen(false); setIntegrationsOpen(true); }}
                      style={{ width: "100%", textAlign: "left", padding: "8px 12px", background: "none", border: "none", color: "var(--text-primary)", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", borderRadius: "6px", fontSize: "0.875rem" }}
                      onMouseOver={(e) => e.currentTarget.style.background = "var(--surface-3)"}
                      onMouseOut={(e) => e.currentTarget.style.background = "none"}
                    >
                      <Settings2 size={16} /> Manage Integrations
                    </button>
                    <button
                      onClick={() => { logout(); setProfileOpen(false); router.push("/"); }}
                      style={{ width: "100%", textAlign: "left", padding: "8px 12px", background: "none", border: "none", color: "var(--error)", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", borderRadius: "6px", fontSize: "0.875rem" }}
                      onMouseOver={(e) => e.currentTarget.style.background = "rgba(239, 68, 68, 0.1)"}
                      onMouseOut={(e) => e.currentTarget.style.background = "none"}
                    >
                      <LogOut size={16} /> Sign out
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <Link href="http://localhost:8000/auth/google/login" style={{ textDecoration: "none", color: "var(--text-secondary)" }}>
              Sign in
            </Link>
          )}
        </div>
      </motion.header>

      {/* Integrations Modal — rendered via portal to document.body so it's not clipped by the header */}
      {mounted && createPortal(
        <AnimatePresence>
          {integrationsOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIntegrationsOpen(false)}
              style={{
                position: "fixed",
                top: 0, left: 0, right: 0, bottom: 0,
                background: "rgba(0,0,0,0.6)",
                backdropFilter: "blur(4px)",
                zIndex: 9999,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                style={{
                  background: "var(--surface-1)",
                  border: "1px solid var(--border-default)",
                  borderRadius: "16px",
                  padding: "24px",
                  width: "420px",
                  maxWidth: "90vw",
                  boxShadow: "0 24px 80px rgba(0,0,0,0.8)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                  <h2 style={{ fontSize: "1.2rem", margin: 0 }}>Integrations</h2>
                  <button
                    onClick={() => setIntegrationsOpen(false)}
                    style={{ background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer", padding: "4px" }}
                  >
                    <X size={20} />
                  </button>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {/* Google */}
                  <div style={{
                    background: "var(--surface-2)",
                    border: "1px solid var(--border-default)",
                    padding: "16px",
                    borderRadius: "12px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>Google</div>
                      <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: "2px" }}>Drive, Gmail, Calendar</div>
                      {user?.has_google ? (
                        <div style={{ fontSize: "0.75rem", color: "var(--success)", marginTop: "4px", display: "flex", alignItems: "center", gap: "4px" }}>
                          <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--success)", display: "inline-block" }} />
                          Connected
                        </div>
                      ) : (
                        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "4px" }}>Not connected</div>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: "8px" }}>
                      {user?.has_google && (
                        <button
                          onClick={async () => {
                            await api.disconnectIntegration("google");
                            await useAuthStore.getState().fetchUser();
                          }}
                          style={{
                            background: "none",
                            border: "1px solid var(--error)",
                            color: "var(--error)",
                            padding: "6px 14px",
                            borderRadius: "8px",
                            cursor: "pointer",
                            fontSize: "0.8rem",
                          }}
                        >
                          Disconnect
                        </button>
                      )}
                      <button 
                        onClick={() => { window.location.href = "http://localhost:8000/auth/google/login"; }}
                        style={{
                          background: user?.has_google ? "var(--surface-3)" : "var(--accent-primary)",
                          border: "1px solid var(--border-default)",
                          color: user?.has_google ? "var(--text-primary)" : "white",
                          padding: "6px 14px",
                          borderRadius: "8px",
                          cursor: "pointer",
                          fontSize: "0.8rem",
                        }}
                      >
                        {user?.has_google ? "Reconnect" : "Connect"}
                      </button>
                    </div>
                  </div>

                  {/* GitHub */}
                  <div style={{
                    background: "var(--surface-2)",
                    border: "1px solid var(--border-default)",
                    padding: "16px",
                    borderRadius: "12px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>GitHub</div>
                      <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: "2px" }}>Repos, Issues, PRs</div>
                      {user?.has_github ? (
                        <div style={{ fontSize: "0.75rem", color: "var(--success)", marginTop: "4px", display: "flex", alignItems: "center", gap: "4px" }}>
                          <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--success)", display: "inline-block" }} />
                          Connected
                        </div>
                      ) : (
                        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "4px" }}>Not connected</div>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: "8px" }}>
                      {user?.has_github && (
                        <button
                          onClick={async () => {
                            await api.disconnectIntegration("github");
                            await useAuthStore.getState().fetchUser();
                          }}
                          style={{
                            background: "none",
                            border: "1px solid var(--error)",
                            color: "var(--error)",
                            padding: "6px 14px",
                            borderRadius: "8px",
                            cursor: "pointer",
                            fontSize: "0.8rem",
                          }}
                        >
                          Disconnect
                        </button>
                      )}
                      <button
                        onClick={() => { window.location.href = `http://localhost:8000/auth/github/connect?token=${token}`; }}
                        style={{
                          background: user?.has_github ? "var(--surface-3)" : "var(--accent-primary)",
                          border: "1px solid var(--border-default)",
                          color: user?.has_github ? "var(--text-primary)" : "white",
                          padding: "6px 14px",
                          borderRadius: "8px",
                          cursor: "pointer",
                          fontSize: "0.8rem",
                          transition: "all 0.15s"
                        }}
                      >
                        {user?.has_github ? "Reconnect" : "Connect"}
                      </button>
                    </div>
                  </div>
                </div>

                <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "16px", textAlign: "center" }}>
                  Integrations are managed via OAuth. Your tokens are stored securely.
                </p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}
