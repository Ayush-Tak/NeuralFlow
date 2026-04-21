"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuthStore } from "@/hooks/useAuthStore";
import {
  Workflow,
  MessageSquare,
  Plug,
  Activity,
  ArrowUpRight,
  Plus,
  Sparkles,
  Clock,
  Trash2,
  Play,
  Zap,
} from "lucide-react";
import styles from "./DashboardContent.module.css";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] },
  },
};

export default function DashboardContent() {
  const { token, user, chatSessionCount } = useAuthStore();
  const [flows, setFlows] = useState<any[]>([]);
  const router = useRouter();

  useEffect(() => {
    if (token) {
      api.listFlows().then(setFlows).catch(console.error);
    }
  }, [token]);

  const activeFlowCount = flows.filter((f: any) => f.status === "active").length;
  const integrationCount = [user?.has_google, user?.has_github].filter(Boolean).length;
  const executionCount = flows.reduce((sum: number, f: any) => sum + (f.execution_count || 0), 0);

  const runFlow = async (e: React.MouseEvent, flowId: string) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await fetch(`http://localhost:8000/flows/${flowId}/execute`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      // Refresh flows to get updated execution count
      setTimeout(() => api.listFlows().then(setFlows).catch(console.error), 2000);
    } catch (err) {
      console.error("Failed to run flow", err);
    }
  };

  const statusColor = (s: string) => {
    if (s === "active") return "var(--success)";
    if (s === "paused") return "var(--warning)";
    if (s === "error") return "var(--error)";
    return "var(--text-muted)";
  };

  const activeStats = [
    {
      label: "Active Flows",
      value: flows.length.toString(),
      change: `${activeFlowCount} active`,
      icon: Workflow,
      color: "var(--accent-primary)",
      bgColor: "var(--accent-glow)",
    },
    {
      label: "Chat Sessions",
      value: chatSessionCount.toString(),
      change: chatSessionCount > 0 ? "sessions total" : "start chatting!",
      icon: MessageSquare,
      color: "var(--info)",
      bgColor: "var(--info-glow)",
    },
    {
      label: "Integrations",
      value: integrationCount.toString(),
      change: integrationCount === 2 ? "All connected" : `${2 - integrationCount} remaining`,
      icon: Plug,
      color: "var(--success)",
      bgColor: "var(--success-glow)",
    },
    {
      label: "Executions",
      value: executionCount.toString(),
      change: executionCount > 0 ? "runs logged" : "run a flow!",
      icon: Activity,
      color: "var(--warning)",
      bgColor: "var(--warning-glow)",
    },
  ];
  return (
    <motion.div
      className={styles.dashboard}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Stats Grid */}
      <div className={styles.statsGrid}>
        {activeStats.map((stat) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.label}
              className={styles.statCard}
              variants={itemVariants}
            >
              <div className={styles.statHeader}>
                <div
                  className={styles.statIcon}
                  style={{ background: stat.bgColor, color: stat.color }}
                >
                  <Icon size={18} />
                </div>
              </div>
              <div className={styles.statValue}>{stat.value}</div>
              <div className={styles.statLabel}>{stat.label}</div>
              <div
                className={styles.statChange}
                style={{ color: stat.color }}
              >
                {stat.change}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Main Content Grid */}
      <div className={styles.contentGrid}>
        {/* Recent Flows */}
        <motion.div className={styles.section} variants={itemVariants}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>
              <Workflow size={18} />
              Recent Flows
            </h2>
            <Link href="/flows/new" passHref legacyBehavior>
              <motion.button
                className={styles.sectionAction}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                id="btn-new-flow-dashboard"
              >
                <Plus size={14} />
                New Flow
              </motion.button>
            </Link>
          </div>

          <div className={styles.flowList}>
            {flows.length === 0 ? (
               <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-secondary)" }}>
                  No flows yet — create one!
               </div>
            ) : (
              <AnimatePresence>
                {flows.map((flow: any, idx: number) => (
                  <motion.div
                    key={flow.id}
                    className={styles.flowCard}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20, height: 0 }}
                    transition={{ delay: 0.3 + idx * 0.1 }}
                    whileHover={{
                      x: 4,
                      backgroundColor: "var(--surface-3)",
                      transition: { duration: 0.15 },
                    }}
                  >
                    <Link href={`/flows/${flow.id}`} style={{ textDecoration: "none", color: "inherit", flex: 1 }}>
                      <div className={styles.flowInfo}>
                        <div className={styles.flowName} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{
                            width: "7px", height: "7px", borderRadius: "50%",
                            background: statusColor(flow.status),
                            display: "inline-block", flexShrink: 0,
                          }} />
                          {flow.name}
                          <span style={{
                            fontSize: "0.65rem", padding: "2px 8px", borderRadius: "10px",
                            background: statusColor(flow.status) + "18",
                            color: statusColor(flow.status),
                            fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px",
                          }}>
                            {flow.status}
                          </span>
                        </div>
                        <div className={styles.flowDesc}>{flow.description || "No description"}</div>
                      </div>
                      <div className={styles.flowMeta} style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
                        <span className={styles.flowNodes}>{flow.nodes?.length || 0} nodes</span>
                        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "3px" }}>
                          <Zap size={11} />
                          {flow.execution_count || 0} runs
                        </span>
                        <span className={styles.flowLastRun}>
                          <Clock size={12} />
                          {flow.updated_at ? new Date(flow.updated_at).toLocaleDateString() : "Never"}
                        </span>
                      </div>
                    </Link>
                    <div style={{ display: "flex", gap: "4px", alignSelf: "center" }}>
                      <motion.button
                        whileHover={{ scale: 1.15 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={(e) => runFlow(e, flow.id)}
                        style={{
                          background: "none", border: "1px solid var(--success)",
                          color: "var(--success)", cursor: "pointer",
                          padding: "5px 10px", borderRadius: "6px",
                          display: "flex", alignItems: "center", gap: "4px",
                          fontSize: "0.7rem", fontWeight: 600,
                          transition: "all 0.15s",
                        }}
                        onMouseOver={(e) => { e.currentTarget.style.background = "var(--success)"; e.currentTarget.style.color = "#fff"; }}
                        onMouseOut={(e) => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = "var(--success)"; }}
                        title="Run flow"
                      >
                        <Play size={11} fill="currentColor" />
                        Run
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.15 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (confirm(`Delete "${flow.name}"?`)) {
                            setFlows((prev) => prev.filter((f: any) => f.id !== flow.id));
                            api.deleteFlow(flow.id).catch((err) => {
                              console.error(err);
                              setFlows((prev) => [...prev, flow]);
                            });
                          }
                        }}
                        style={{
                          background: "none", border: "none",
                          color: "var(--text-muted)", cursor: "pointer",
                          padding: "6px", borderRadius: "6px",
                          display: "flex", alignItems: "center",
                          transition: "color 0.15s",
                        }}
                        onMouseOver={(e) => e.currentTarget.style.color = "var(--error)"}
                        onMouseOut={(e) => e.currentTarget.style.color = "var(--text-muted)"}
                        title="Delete flow"
                      >
                        <Trash2 size={14} />
                      </motion.button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>
        </motion.div>

        {/* Right Column */}
        <div className={styles.rightCol}>

          {/* Quick Chat */}
          <motion.div
            className={`${styles.section} ${styles.quickChat}`}
            variants={itemVariants}
          >
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>
                <Sparkles size={18} />
                Quick Ask
              </h2>
            </div>
            <div
              className={styles.chatPrompt}
              style={{ cursor: "pointer" }}
              onClick={() => router.push("/chat")}
            >
              <input
                type="text"
                placeholder="Ask your AI assistant anything..."
                className={styles.chatInput}
                id="quick-chat-input"
                readOnly
                style={{ cursor: "pointer" }}
              />
              <motion.button
                className={styles.chatSend}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                <ArrowUpRight size={16} />
              </motion.button>
            </div>
            <div className={styles.chatSuggestions}>
              {[
                "What's on my calendar today?",
                "Summarize unread emails",
                "Show open PRs",
              ].map((suggestion) => (
                <motion.button
                  key={suggestion}
                  className={styles.suggestion}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => router.push("/chat")}
                >
                  {suggestion}
                </motion.button>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
