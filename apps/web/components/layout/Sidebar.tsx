"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  MessageSquare,
  Workflow,
  ChevronLeft,
  ChevronRight,
  Zap,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./Sidebar.module.css";

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

const navItems = [
  { href: "/", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/chat", icon: MessageSquare, label: "Chat" },
  { href: "/flows/new", icon: Workflow, label: "Flow Editor" },
];

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();

  return (
    <motion.aside
      className={styles.sidebar}
      animate={{ width: collapsed ? 72 : 260 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Logo */}
      <div className={styles.logoSection}>
        <motion.div
          className={styles.logoIcon}
          whileHover={{ rotate: 180, scale: 1.1 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          <Zap size={22} />
        </motion.div>
        <AnimatePresence>
          {!collapsed && (
            <motion.span
              className={styles.logoText}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
            >
              NeuralFlow
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <nav className={styles.nav}>
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link key={item.href} href={item.href} className={styles.navLink}>
              <motion.div
                className={`${styles.navItem} ${isActive ? styles.navItemActive : ""}`}
                whileHover={{ x: 4 }}
                whileTap={{ scale: 0.97 }}
                transition={{ duration: 0.2 }}
              >
                {isActive && (
                  <motion.div
                    className={styles.activeIndicator}
                    layoutId="activeNav"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                <Icon size={20} className={styles.navIcon} />
                <AnimatePresence>
                  {!collapsed && (
                    <motion.span
                      className={styles.navLabel}
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: "auto" }}
                      exit={{ opacity: 0, width: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.div>
            </Link>
          );
        })}
      </nav>

      {/* AI Status */}
      <div className={styles.bottomSection}>
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              className={styles.aiStatus}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
            >
              <div className={styles.aiStatusDot} />
              <div className={styles.aiStatusText}>
                <span className={styles.aiStatusLabel}>AI Assistant</span>
                <span className={styles.aiStatusValue}>Online</span>
              </div>
              <Sparkles size={14} className={styles.aiSparkle} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Collapse Toggle */}
        <motion.button
          className={styles.toggleBtn}
          onClick={onToggle}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </motion.button>
      </div>
    </motion.aside>
  );
}
