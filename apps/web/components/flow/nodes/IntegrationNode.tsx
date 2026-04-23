"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Calendar, Mail, Github, HardDrive } from "lucide-react";
import { TOOL_REGISTRY } from "@/lib/toolRegistry";
import styles from "./FlowNode.module.css";

const integrationMeta: Record<string, { icon: React.ElementType; colorClass: string }> = {
  "google-calendar": { icon: Calendar, colorClass: "iconGCal" },
  gmail: { icon: Mail, colorClass: "iconGmail" },
  "google-drive": { icon: HardDrive, colorClass: "iconGDrive" },
  github: { icon: Github, colorClass: "iconGithub" },
};

// DO NOT wrap in memo() — data.config changes need to trigger re-renders
export default function IntegrationNode({ data, selected }: NodeProps) {
  const meta = integrationMeta[(data.integrationId as string) || ""] || {
    icon: Calendar,
    colorClass: "iconGCal",
  };
  const Icon = meta.icon;

  const config = (data.config || {}) as Record<string, any>;
  const toolName = config.tool_name as string | undefined;
  const integrationId = (data.integrationId || "") as string;

  // Look up the human-readable tool label
  let toolLabel = toolName || "";
  if (toolName && TOOL_REGISTRY[integrationId]) {
    const toolDef = TOOL_REGISTRY[integrationId].tools.find((t) => t.name === toolName);
    if (toolDef) toolLabel = toolDef.label;
  }

  return (
    <div
      className={`${styles.node} ${styles.nodeIntegration} ${selected ? styles.nodeSelected : ""}`}
    >
      <Handle type="target" position={Position.Left} className={styles.handle} />
      <div className={styles.nodeHeader}>
        <div className={`${styles.nodeIcon} ${styles[meta.colorClass]}`}>
          <Icon size={16} />
        </div>
        <div className={styles.nodeType}>Integration</div>
      </div>
      <div className={styles.nodeLabel}>{data.label as string}</div>
      {toolLabel ? (
        <div className={styles.nodeDetail}>{toolLabel}</div>
      ) : (
        <div className={styles.nodeDetail} style={{ opacity: 0.5 }}>Click to configure</div>
      )}
      <Handle type="source" position={Position.Right} className={styles.handle} />
    </div>
  );
}
