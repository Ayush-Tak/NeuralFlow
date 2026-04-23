"use client";

import { useState, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import { X, Trash2 } from "lucide-react";
import type { Node } from "@xyflow/react";
import { TOOL_REGISTRY } from "@/lib/toolRegistry";
import styles from "./NodeConfigPanel.module.css";

interface NodeConfigPanelProps {
  node: Node;
  nodes: Node[];
  onUpdateNode: (nodeId: string, newData: Record<string, unknown>) => void;
  onDeleteNode: (nodeId: string) => void;
  onClose: () => void;
}

export default function NodeConfigPanel({
  node,
  nodes,
  onUpdateNode,
  onDeleteNode,
  onClose,
}: NodeConfigPanelProps) {
  const data = node.data as Record<string, any>;
  const nodeType = node.type || "";
  const integrationId = (data.integrationId || "") as string;

  // Use LOCAL state for config — sync from props on node change, push to parent on update
  const [config, setConfig] = useState<Record<string, any>>(() => data.config || {});

  // Re-sync when a different node is selected
  useEffect(() => {
    setConfig(data.config || {});
  }, [node.id]); // only re-sync on node ID change, not on every data change

  // Push config changes to the parent (updates the node in the flow)
  const pushConfig = (newConfig: Record<string, any>) => {
    setConfig(newConfig);
    onUpdateNode(node.id, { ...data, config: newConfig });
  };

  const updateConfigField = (key: string, value: unknown) => {
    pushConfig({ ...config, [key]: value });
  };

  const updateArg = (argName: string, value: string) => {
    const currentArgs = config.args || {};
    pushConfig({ ...config, args: { ...currentArgs, [argName]: value } });
  };

  // Get upstream node IDs for context reference hints
  const upstreamNodeIds = useMemo(() => {
    return nodes
      .filter((n) => n.id !== node.id)
      .map((n) => ({
        id: n.id,
        label: (n.data as any).label || n.id,
      }));
  }, [nodes, node.id]);

  // Render trigger config
  const renderTriggerConfig = () => (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>Trigger Settings</div>
      <div className={styles.field}>
        <label className={styles.fieldLabel}>Trigger Type</label>
        <select
          className={styles.select}
          value={config.triggerType || "manual"}
          onChange={(e) => updateConfigField("triggerType", e.target.value)}
        >
          <option value="manual">Manual</option>
          <option value="schedule">Schedule</option>
          <option value="webhook">Webhook</option>
        </select>
      </div>
      {config.triggerType === "schedule" && (
        <div className={styles.field}>
          <label className={styles.fieldLabel}>Cron Expression</label>
          <input
            className={styles.input}
            value={config.cron || ""}
            onChange={(e) => updateConfigField("cron", e.target.value)}
            placeholder="0 9 * * * (daily at 9am)"
          />
        </div>
      )}
    </div>
  );

  // Render AI Agent config
  const renderAIAgentConfig = () => (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>AI Agent Settings</div>
      <div className={styles.field}>
        <label className={styles.fieldLabel}>
          Prompt <span className={styles.required}>*</span>
        </label>
        <textarea
          className={styles.textarea}
          value={config.prompt || ""}
          onChange={(e) => updateConfigField("prompt", e.target.value)}
          placeholder="Describe what the AI should do with the upstream data. E.g.: Summarize these emails into bullet points"
          rows={4}
        />
      </div>
      {upstreamNodeIds.length > 0 && (
        <div className={styles.contextHint}>
          Upstream data from {upstreamNodeIds.map((n) => n.label).join(", ")} will
          be passed automatically as context.
        </div>
      )}
    </div>
  );

  // Render integration config
  const renderIntegrationConfig = () => {
    const integration = TOOL_REGISTRY[integrationId];
    if (!integration) {
      return (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Configuration</div>
          <div className={styles.contextHint}>
            Unknown integration: {integrationId}
          </div>
        </div>
      );
    }

    const selectedTool = config.tool_name || "";
    const toolDef = integration.tools.find((t) => t.name === selectedTool);
    const currentArgs = config.args || {};

    return (
      <>
        <div className={styles.section}>
          <div className={styles.sectionTitle}>
            Action — {integration.label}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {integration.tools.map((tool) => (
              <div
                key={tool.name}
                className={`${styles.toolOption} ${
                  selectedTool === tool.name ? styles.toolOptionActive : ""
                }`}
                onClick={() => {
                  const defaults: Record<string, string> = {};
                  tool.args.forEach((a) => {
                    if (a.defaultValue) defaults[a.name] = a.defaultValue;
                  });
                  pushConfig({
                    ...config,
                    server_name: integrationId,
                    tool_name: tool.name,
                    args: defaults,
                  });
                }}
              >
                <div className={styles.toolOptionName}>{tool.label}</div>
                <div className={styles.toolOptionDesc}>{tool.description}</div>
              </div>
            ))}
          </div>
        </div>

        {toolDef && (
          <div className={styles.section}>
            <div className={styles.sectionTitle}>Arguments</div>
            {toolDef.args.map((arg) => (
              <div key={arg.name} className={styles.field}>
                <label className={styles.fieldLabel}>
                  {arg.label}
                  {arg.required && (
                    <span className={styles.required}>*</span>
                  )}
                </label>
                {arg.type === "select" ? (
                  <select
                    className={styles.select}
                    value={currentArgs[arg.name] || arg.defaultValue || ""}
                    onChange={(e) => updateArg(arg.name, e.target.value)}
                  >
                    {arg.options?.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    className={styles.input}
                    type={arg.type === "number" ? "number" : "text"}
                    value={currentArgs[arg.name] || ""}
                    onChange={(e) => updateArg(arg.name, e.target.value)}
                    placeholder={arg.placeholder}
                  />
                )}
              </div>
            ))}
            {upstreamNodeIds.length > 0 && (
              <div className={styles.contextHint}>
                💡 Use <code>$context.nodeId.result</code> to reference
                upstream output. Available nodes:{" "}
                {upstreamNodeIds.map((n) => n.id).join(", ")}
              </div>
            )}
          </div>
        )}
      </>
    );
  };

  return (
    <motion.div
      className={styles.panel}
      initial={{ width: 0, opacity: 0 }}
      animate={{ width: 320, opacity: 1 }}
      exit={{ width: 0, opacity: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className={styles.header}>
        <div className={styles.headerTitle}>
          {(data.label as string) || "Node Config"}
        </div>
        <button className={styles.closeBtn} onClick={onClose}>
          <X size={16} />
        </button>
      </div>

      <div className={styles.body}>
        <div className={styles.nodeId}>ID: {node.id}</div>

        {nodeType === "trigger" && renderTriggerConfig()}
        {nodeType === "aiAgent" && renderAIAgentConfig()}
        {nodeType === "integration" && renderIntegrationConfig()}

        <button
          className={styles.deleteBtn}
          onClick={() => {
            onDeleteNode(node.id);
            onClose();
          }}
        >
          <Trash2 size={14} style={{ marginRight: 6, verticalAlign: "middle" }} />
          Delete Node
        </button>
      </div>
    </motion.div>
  );
}
