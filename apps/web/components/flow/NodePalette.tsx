"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Zap,
  Clock,
  Webhook,
  Brain,
  Calendar,
  Mail,
  Github,
  FileText,
  MessageSquare,
  GitBranch,
  Repeat,
  ArrowUpRight,
  Search,
  HardDrive,
} from "lucide-react";
import styles from "./NodePalette.module.css";

interface PaletteItem {
  type: string;
  label: string;
  icon: React.ElementType;
  color: string;
  description: string;
  integrationId?: string;
}

interface PaletteGroup {
  title: string;
  items: PaletteItem[];
}

const paletteGroups: PaletteGroup[] = [
  {
    title: "Triggers",
    items: [
      { type: "trigger", label: "Manual", icon: Zap, color: "var(--node-trigger)", description: "Run manually" },
      { type: "trigger", label: "Schedule", icon: Clock, color: "var(--node-trigger)", description: "Run on a cron schedule" },
      { type: "trigger", label: "Webhook", icon: Webhook, color: "var(--node-trigger)", description: "Triggered by HTTP request" },
    ],
  },
  {
    title: "AI",
    items: [
      { type: "aiAgent", label: "AI Agent", icon: Brain, color: "var(--node-ai)", description: "LLM with tool access" },
    ],
  },
  {
    title: "Integrations",
    items: [
      { type: "integration", label: "Google Calendar", icon: Calendar, color: "var(--node-google-cal)", description: "Read/create events", integrationId: "google-calendar" },
      { type: "integration", label: "Gmail", icon: Mail, color: "var(--node-gmail)", description: "Read/send emails", integrationId: "gmail" },
      { type: "integration", label: "Google Drive", icon: HardDrive, color: "var(--node-google-cal)", description: "Search/read files", integrationId: "google-drive" },
      { type: "integration", label: "GitHub", icon: Github, color: "var(--node-github)", description: "Repos, issues, PRs", integrationId: "github" },
    ],
  },
];

export default function NodePalette() {
  const [search, setSearch] = useState("");

  const filteredGroups = paletteGroups
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) =>
          item.label.toLowerCase().includes(search.toLowerCase()) ||
          item.description.toLowerCase().includes(search.toLowerCase())
      ),
    }))
    .filter((group) => group.items.length > 0);

  const onDragStart = (
    event: React.DragEvent,
    item: PaletteItem
  ) => {
    event.dataTransfer.setData("application/neuralflow-node-type", item.type);
    event.dataTransfer.setData("application/neuralflow-node-label", item.label);
    if (item.integrationId) {
      event.dataTransfer.setData("application/neuralflow-integration-id", item.integrationId);
    }
    event.dataTransfer.effectAllowed = "move";
  };

  return (
    <div className={styles.palette}>
      <div className={styles.searchWrapper}>
        <Search size={14} className={styles.searchIcon} />
        <input
          type="text"
          placeholder="Search nodes..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={styles.searchInput}
          id="search-nodes"
        />
      </div>

      <div className={styles.groups}>
        {filteredGroups.map((group) => (
          <div key={group.title} className={styles.group}>
            <div className={styles.groupTitle}>{group.title}</div>
            <div className={styles.items}>
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <motion.div
                    key={`${item.type}-${item.label}`}
                    className={styles.item}
                    draggable
                    onDragStart={(e) => onDragStart(e as unknown as React.DragEvent, item)}
                    whileHover={{ x: 4, backgroundColor: "var(--surface-3)" }}
                    whileTap={{ scale: 0.97 }}
                  >
                    <div
                      className={styles.itemIcon}
                      style={{
                        background: `color-mix(in srgb, ${item.color} 15%, transparent)`,
                        color: item.color,
                      }}
                    >
                      <Icon size={14} />
                    </div>
                    <div className={styles.itemInfo}>
                      <div className={styles.itemLabel}>{item.label}</div>
                      <div className={styles.itemDesc}>{item.description}</div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
