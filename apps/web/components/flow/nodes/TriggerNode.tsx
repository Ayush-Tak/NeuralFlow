"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Zap, Clock, Webhook } from "lucide-react";
import styles from "./FlowNode.module.css";

function TriggerNode({ data, selected }: NodeProps) {
  const iconMap: Record<string, React.ElementType> = {
    manual: Zap,
    schedule: Clock,
    webhook: Webhook,
  };
  const Icon = iconMap[data.config?.triggerType as string] || Zap;

  return (
    <div className={`${styles.node} ${styles.nodeTrigger} ${selected ? styles.nodeSelected : ""}`}>
      <div className={styles.nodeHeader}>
        <div className={`${styles.nodeIcon} ${styles.iconTrigger}`}>
          <Icon size={16} />
        </div>
        <div className={styles.nodeType}>Trigger</div>
      </div>
      <div className={styles.nodeLabel}>{data.label as string}</div>
      <Handle type="source" position={Position.Right} className={styles.handle} />
    </div>
  );
}

export default memo(TriggerNode);
