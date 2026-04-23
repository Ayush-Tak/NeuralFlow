"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Brain } from "lucide-react";
import styles from "./FlowNode.module.css";

// DO NOT wrap in memo() — data.config changes need to trigger re-renders
export default function AIAgentNode({ data, selected }: NodeProps) {
  const config = (data.config || {}) as Record<string, any>;
  const prompt = (config.prompt || "") as string;

  return (
    <div className={`${styles.node} ${styles.nodeAI} ${selected ? styles.nodeSelected : ""}`}>
      <Handle type="target" position={Position.Left} className={styles.handle} />
      <div className={styles.nodeHeader}>
        <div className={`${styles.nodeIcon} ${styles.iconAI}`}>
          <Brain size={16} />
        </div>
        <div className={styles.nodeType}>AI Agent</div>
      </div>
      <div className={styles.nodeLabel}>{data.label as string}</div>
      {prompt ? (
        <div className={styles.nodeDetail}>
          {prompt.length > 50 ? prompt.slice(0, 50) + "..." : prompt}
        </div>
      ) : (
        <div className={styles.nodeDetail} style={{ opacity: 0.5 }}>Click to set prompt</div>
      )}
      <Handle type="source" position={Position.Right} className={styles.handle} />
    </div>
  );
}
