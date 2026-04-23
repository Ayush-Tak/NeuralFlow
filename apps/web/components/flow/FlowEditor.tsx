"use client";

import { useCallback, useMemo, useState, useEffect } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Edge,
  type Node,
  BackgroundVariant,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Save, ChevronRight, Undo2, Redo2, Loader2, CheckCircle2 } from "lucide-react";
import TriggerNode from "./nodes/TriggerNode";
import AIAgentNode from "./nodes/AIAgentNode";
import IntegrationNode from "./nodes/IntegrationNode";
import NodePalette from "./NodePalette";
import NodeConfigPanel from "./NodeConfigPanel";
import { api } from "@/lib/api";
import { useAuthStore } from "@/hooks/useAuthStore";
import styles from "./FlowEditor.module.css";

interface FlowEditorProps {
  flowId: string;
  sidebarCollapsed: boolean;
}

export default function FlowEditor({ flowId, sidebarCollapsed }: FlowEditorProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [paletteOpen, setPaletteOpen] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [loading, setLoading] = useState(flowId !== "new");
  const [flowName, setFlowName] = useState(flowId === "new" ? "New Flow" : "Loading...");
  const [flowDesc, setFlowDesc] = useState("");
  const [flowStatus, setFlowStatus] = useState("draft");
  const [runStatus, setRunStatus] = useState<string | null>(null);
  const [executionResults, setExecutionResults] = useState<any | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const { token } = useAuthStore();

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId) || null,
    [nodes, selectedNodeId]
  );

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
  }, []);

  const onUpdateNode = useCallback(
    (nodeId: string, newData: Record<string, unknown>) => {
      setNodes((nds) =>
        nds.map((n) => (n.id === nodeId ? { ...n, data: newData } : n))
      );
    },
    [setNodes]
  );

  const onDeleteNode = useCallback(
    (nodeId: string) => {
      setNodes((nds) => nds.filter((n) => n.id !== nodeId));
      setEdges((eds) =>
        eds.filter((e) => e.source !== nodeId && e.target !== nodeId)
      );
    },
    [setNodes, setEdges]
  );

  useEffect(() => {
    if (flowId !== "new" && token) {
      api.getFlow(flowId)
        .then((data) => {
          const safeNodes = (data.nodes || []).map((n: any, i: number) => ({
            ...n,
            position: n.position || { x: 100 + i * 200, y: 200 },
          }));
          setNodes(safeNodes);
          setEdges(data.edges || []);
          setFlowName(data.name || "Untitled Flow");
          setFlowDesc(data.description || "");
          setFlowStatus(data.status || "draft");
          setLoading(false);
        })
        .catch((err) => {
          console.error(err);
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, [flowId, token, setNodes, setEdges]);

  const nodeTypes = useMemo(
    () => ({
      trigger: TriggerNode,
      aiAgent: AIAgentNode,
      integration: IntegrationNode,
    }),
    []
  );

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) => addEdge({ ...params, animated: false }, eds));
    },
    [setEdges]
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const type = event.dataTransfer.getData("application/neuralflow-node-type");
      const label = event.dataTransfer.getData("application/neuralflow-node-label");
      const integrationId = event.dataTransfer.getData("application/neuralflow-integration-id");

      if (!type) return;

      const position = {
        x: event.clientX - 250,
        y: event.clientY - 100,
      };

      const defaultConfig: Record<string, any> = {};
      if (integrationId) {
        defaultConfig.server_name = integrationId;
      }

      const newNode: Node = {
        id: `${type}-${Date.now()}`,
        type,
        position,
        data: { label, integrationId, config: defaultConfig },
      };

      setSelectedNodeId(newNode.id);

      setNodes((nds) => nds.concat(newNode));
    },
    [setNodes]
  );

  const handleSave = async () => {
    if (!token) return;
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      if (flowId === "new") {
        const result = await api.createFlow({ name: flowName, description: flowDesc, nodes, edges });
        window.location.href = `/flows/${(result as any).id}`;
      } else {
        await api.updateFlow(flowId, { name: flowName, description: flowDesc, status: flowStatus, nodes, edges });
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRun = async () => {
    if (!token || flowId === "new") return;
    
    setIsSaving(true);
    try {
      await api.updateFlow(flowId, { name: flowName, description: flowDesc, status: flowStatus, nodes, edges });
    } catch (err) {
      console.error("Failed to save before run:", err);
    }
    setIsSaving(false);
    
    setIsRunning(true);
    setRunStatus("Starting execution...");
    setExecutionResults(null);
    try {
      const response = await fetch(`http://localhost:8000/flows/${flowId}/execute`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({ detail: "Execution failed" }));
        setRunStatus(`❌ ${err.detail || "Execution failed"}`);
        setIsRunning(false);
        setTimeout(() => setRunStatus(null), 5000);
        return;
      }
      const { execution_id } = await response.json();
      setRunStatus("⏳ Running flow...");

      // Poll for execution results
      let attempts = 0;
      const maxAttempts = 30;
      const poll = async () => {
        attempts++;
        try {
          const statusRes = await fetch(
            `http://localhost:8000/flows/${flowId}/executions/${execution_id}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          if (statusRes.ok) {
            const result = await statusRes.json();
            if (result.status === "completed" || result.status === "failed") {
              setExecutionResults(result);
              setRunStatus(result.status === "completed" ? "✅ Flow completed!" : "❌ Flow failed");
              setIsRunning(false);
              setTimeout(() => setRunStatus(null), 5000);
              return;
            }
          }
        } catch {}
        if (attempts < maxAttempts) {
          setTimeout(poll, 2000);
        } else {
          setRunStatus("⏳ Flow is still running in background");
          setIsRunning(false);
          setTimeout(() => setRunStatus(null), 5000);
        }
      };
      setTimeout(poll, 2000);
    } catch (err) {
      console.error(err);
      setRunStatus("❌ Failed to connect to server");
      setIsRunning(false);
      setTimeout(() => setRunStatus(null), 5000);
    }
  };

  if (loading) {
     return <div style={{ display: "flex", height: "100%", alignItems: "center", justifyContent: "center" }}><Loader2 size={48} className={styles.runSpinner} style={{ color: "var(--accent-primary)" }} /></div>;
  }

  return (
    <div className={styles.editor}>
      {/* Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <motion.button
            className={styles.paletteToggle}
            onClick={() => setPaletteOpen(!paletteOpen)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <motion.span
              animate={{ rotate: paletteOpen ? 90 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronRight size={16} />
            </motion.span>
            Nodes
          </motion.button>
          <div className={styles.toolbarDivider} />
          <input
            value={flowName}
            onChange={(e) => setFlowName(e.target.value)}
            className={styles.flowTitle}
            style={{
              background: "none",
              border: "1px solid transparent",
              color: "var(--text-primary)",
              fontSize: "inherit",
              fontWeight: "inherit",
              fontFamily: "inherit",
              padding: "2px 6px",
              borderRadius: "6px",
              outline: "none",
              width: "200px",
              transition: "border-color 0.15s",
            }}
            onFocus={(e) => e.currentTarget.style.borderColor = "var(--accent-primary)"}
            onBlur={(e) => e.currentTarget.style.borderColor = "transparent"}
          />
        </div>

        <div className={styles.toolbarRight}>
          <motion.button
            className={styles.toolbarBtn}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            title="Undo"
          >
            <Undo2 size={16} />
          </motion.button>
          <motion.button
            className={styles.toolbarBtn}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            title="Redo"
          >
            <Redo2 size={16} />
          </motion.button>
          <div className={styles.toolbarDivider} />
          <motion.button
            className={styles.saveBtn}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={handleSave}
            disabled={isSaving}
            id="btn-save-flow"
            animate={saveSuccess ? { boxShadow: ["0 0 0px rgba(34,197,94,0)", "0 0 20px rgba(34,197,94,0.4)", "0 0 0px rgba(34,197,94,0)"] } : {}}
            transition={saveSuccess ? { duration: 1.5 } : {}}
          >
            {saveSuccess ? <CheckCircle2 size={16} style={{ color: "var(--success)" }} /> : isSaving ? <Loader2 size={16} className={styles.runSpinner} /> : <Save size={16} />}
            {saveSuccess ? "Saved!" : isSaving ? "Saving..." : "Save"}
          </motion.button>
          <motion.button
            className={`${styles.runBtn} ${isRunning ? styles.runBtnRunning : ""}`}
            whileHover={!isRunning ? { scale: 1.03 } : {}}
            whileTap={!isRunning ? { scale: 0.97 } : {}}
            onClick={handleRun}
            disabled={isRunning}
            id="btn-run-flow"
          >
            {isRunning ? (
              <span className={styles.runSpinner} />
            ) : (
              <Play size={16} />
            )}
            {isRunning ? "Running..." : "Run"}
          </motion.button>
        </div>
      </div>

      <div style={{
        display: "flex", gap: "16px", padding: "8px 16px",
        background: "var(--surface-1)", borderBottom: "1px solid var(--border-subtle)",
        alignItems: "center", fontSize: "0.85rem",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <label style={{ color: "var(--text-secondary)", whiteSpace: "nowrap" }}>Description:</label>
          <input value={flowDesc} onChange={(e) => setFlowDesc(e.target.value)}
            placeholder="What does this flow do?"
            style={{ background: "var(--surface-2)", border: "1px solid var(--border-subtle)",
              color: "var(--text-primary)", padding: "4px 8px", borderRadius: "6px",
              outline: "none", width: "250px", fontSize: "inherit" }}
          />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <label style={{ color: "var(--text-secondary)" }}>Status:</label>
          <select value={flowStatus} onChange={(e) => setFlowStatus(e.target.value)}
            style={{ background: "var(--surface-2)", border: "1px solid var(--border-subtle)",
              color: "var(--text-primary)", padding: "4px 8px", borderRadius: "6px",
              outline: "none", fontSize: "inherit" }}>
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
          </select>
        </div>
      </div>

      <div className={styles.canvasArea}>
        {/* Node Palette */}
        <AnimatePresence>
          {paletteOpen && (
            <motion.div
              className={styles.paletteWrapper}
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 260, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            >
              <NodePalette />
            </motion.div>
          )}
        </AnimatePresence>

        {/* React Flow Canvas */}
        <div className={styles.canvas}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onDragOver={onDragOver}
            onDrop={onDrop}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            nodeTypes={nodeTypes}
            deleteKeyCode={["Backspace", "Delete"]}
            fitView
            fitViewOptions={{ padding: 0.3 }}
            defaultEdgeOptions={{
              style: { stroke: "rgba(139, 92, 246, 0.4)", strokeWidth: 2 },
              type: "smoothstep",
              selectable: true,
            }}
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={20}
              size={1}
              color="rgba(255,255,255,0.05)"
            />
            <Controls
              showInteractive={false}
              position="bottom-right"
            />
            <MiniMap
              nodeColor={() => "var(--accent-primary)"}
              maskColor="rgba(0,0,0,0.7)"
              position="bottom-right"
              style={{ marginBottom: 50 }}
            />
          </ReactFlow>
        </div>

        {/* Node Config Panel */}
        <AnimatePresence>
          {selectedNode && (
            <NodeConfigPanel
              node={selectedNode}
              nodes={nodes}
              onUpdateNode={onUpdateNode}
              onDeleteNode={onDeleteNode}
              onClose={() => setSelectedNodeId(null)}
            />
          )}
        </AnimatePresence>
      </div>

      {/* Execution Status Toast */}
      <AnimatePresence>
        {runStatus && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            style={{
              position: "absolute",
              bottom: "20px",
              left: "50%",
              transform: "translateX(-50%)",
              background: "var(--surface-2)",
              border: "1px solid var(--border-default)",
              padding: "12px 24px",
              borderRadius: "12px",
              boxShadow: "0 10px 40px rgba(0,0,0,0.5)",
              zIndex: 100,
              color: "var(--text-primary)",
              fontSize: "0.9rem",
            }}
          >
            {runStatus}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Execution Results Panel */}
      <AnimatePresence>
        {executionResults && (
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              maxHeight: "40vh",
              background: "var(--surface-1)",
              borderTop: "1px solid var(--border-default)",
              zIndex: 50,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 20px",
              borderBottom: "1px solid var(--border-subtle)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <CheckCircle2 size={16} style={{ color: executionResults.status === "completed" ? "var(--success)" : "var(--error)" }} />
                <span style={{ fontWeight: 600, fontSize: "0.9rem", color: "var(--text-primary)" }}>
                  Execution {executionResults.status === "completed" ? "Completed" : "Failed"}
                </span>
                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                  {executionResults.completed_at ? new Date(executionResults.completed_at).toLocaleTimeString() : ""}
                </span>
              </div>
              <button
                onClick={() => setExecutionResults(null)}
                style={{
                  background: "var(--surface-2)",
                  border: "1px solid var(--border-subtle)",
                  color: "var(--text-secondary)",
                  padding: "4px 12px",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: "0.8rem",
                }}
              >
                Dismiss
              </button>
            </div>
            <div style={{
              overflowY: "auto",
              padding: "16px 20px",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
            }}>
              {executionResults.node_results?.results?.map((result: any, i: number) => (
                <div key={i} style={{
                  background: "var(--surface-2)",
                  border: `1px solid ${result.status === "success" ? "var(--success)" : "var(--error)"}`,
                  borderRadius: "8px",
                  padding: "12px 16px",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                    <span style={{
                      fontSize: "0.7rem",
                      fontWeight: 600,
                      textTransform: "uppercase" as const,
                      color: result.status === "success" ? "var(--success)" : "var(--error)",
                    }}>
                      {result.status}
                    </span>
                    <span style={{
                      fontSize: "0.8rem",
                      fontFamily: "var(--font-mono)",
                      color: "var(--text-muted)",
                    }}>
                      {result.node_id}
                    </span>
                  </div>
                  <pre style={{
                    fontSize: "0.75rem",
                    color: "var(--text-secondary)",
                    margin: 0,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    maxHeight: "120px",
                    overflowY: "auto",
                    fontFamily: "var(--font-mono)",
                  }}>
                    {result.error
                      ? result.error
                      : JSON.stringify(result.result, null, 2)
                    }
                  </pre>
                </div>
              )) || (
                executionResults.node_results?.error && (
                  <div style={{
                    background: "var(--surface-2)",
                    border: "1px solid var(--error)",
                    borderRadius: "8px",
                    padding: "12px 16px",
                  }}>
                    <pre style={{
                      fontSize: "0.8rem",
                      color: "var(--error)",
                      margin: 0,
                      whiteSpace: "pre-wrap",
                      fontFamily: "var(--font-mono)",
                    }}>
                      {executionResults.node_results.error}
                    </pre>
                  </div>
                )
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
