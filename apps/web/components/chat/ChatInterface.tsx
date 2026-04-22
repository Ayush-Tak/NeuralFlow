"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuthStore } from "@/hooks/useAuthStore";
import { wsClient } from "@/lib/ws";
import {
  Send,
  Sparkles,
  Calendar,
  Mail,
  GitBranch,
  Bot,
  User,
  Loader2,
  Wrench,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import styles from "./ChatInterface.module.css";

interface ToolCall {
  id: string;
  toolName: string;
  serverName: string;
  status: "calling" | "success" | "error";
  result?: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolCalls?: ToolCall[];
  timestamp: Date;
}

const suggestions = [
  { icon: Calendar, text: "What's on my calendar today?", color: "var(--node-google-cal)" },
  { icon: Mail, text: "Summarize my unread emails", color: "var(--node-gmail)" },
  { icon: GitBranch, text: "Show my open pull requests", color: "var(--node-github)" },
  { icon: Sparkles, text: "Create a morning briefing flow", color: "var(--accent-primary)" },
];

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState(false);
  const [sessionCounted, setSessionCounted] = useState(false);
  const { token, incrementChatSession } = useAuthStore();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!token) return;

    const handleConnect = () => {
      setIsConnected(true);
      setConnectionError(false);
    };

    const handleDisconnect = () => {
      setIsConnected(false);
    };

    const handleError = () => {
      setConnectionError(true);
      setIsConnected(false);
    };

    const handleMessage = (event: any) => {
      const payload = event.payload;
      // Backend echoes user messages back — skip them since we already added it locally
      if (payload.role === "user") return;
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: payload.role,
          content: payload.content,
          timestamp: new Date(),
        },
      ]);
      setIsThinking(false);
    };

    const handleToolCall = (event: any) => {
      const payload = event.payload;
      setMessages((prev) => {
        const newMessages = [...prev];
        const lastMsg = newMessages[newMessages.length - 1];
        
        if (lastMsg && lastMsg.role === "assistant" && !lastMsg.content) {
          lastMsg.toolCalls = lastMsg.toolCalls || [];
          const existingCallIndex = lastMsg.toolCalls.findIndex(tc => tc.toolName === payload.toolName && tc.status === "calling");
          
          if (existingCallIndex >= 0) {
            lastMsg.toolCalls[existingCallIndex] = {
              ...lastMsg.toolCalls[existingCallIndex],
              status: payload.status,
              result: payload.result,
            };
          } else {
             lastMsg.toolCalls.push({
                id: crypto.randomUUID(),
                toolName: payload.tool_name || payload.toolName,
                serverName: payload.server_name || payload.serverName,
                status: payload.status,
                result: payload.result,
             });
          }
        } else {
           newMessages.push({
             id: crypto.randomUUID(),
             role: "assistant",
             content: "",
             timestamp: new Date(),
             toolCalls: [{
                id: crypto.randomUUID(),
                toolName: payload.tool_name || payload.toolName,
                serverName: payload.server_name || payload.serverName,
                status: payload.status,
                result: payload.result,
             }]
           });
        }
        return newMessages;
      });
    };

    const handleChatError = (event: any) => {
      const payload = event.payload;
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: `⚠️ Error: ${payload?.message || "Something went wrong"}`,
          timestamp: new Date(),
        },
      ]);
      setIsThinking(false);
    };

    wsClient.on("chat:message", handleMessage);
    wsClient.on("chat:tool_call", handleToolCall);
    wsClient.on("chat:error", handleChatError);

    wsClient.connect("/ws/chat", token)
      .then(handleConnect)
      .catch(handleError);

    return () => {
      wsClient.off("chat:message", handleMessage);
      wsClient.off("chat:tool_call", handleToolCall);
      wsClient.off("chat:error", handleChatError);
      wsClient.disconnect();
    };
  }, [token]);

  const sendMessage = async (text?: string) => {
    const content = text || input;
    if (!content.trim() || isThinking) return;

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: content.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsThinking(true);

    if (!sessionCounted) {
      incrementChatSession();
      setSessionCounted(true);
    }

    if (!isConnected) return;

    // Send to WebSocket
    wsClient.send({
      type: "chat:message",
      payload: { content: content.trim() },
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const isEmpty = messages.length === 0;

  return (
    <div className={styles.chat}>
      {/* Messages Area */}
      <div className={styles.messagesArea}>
        {isEmpty ? (
          <motion.div
            className={styles.emptyState}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            {connectionError ? (
               <>
                  <div className={styles.emptyIcon} style={{ color: "var(--error)" }}>
                    <XCircle size={40} />
                  </div>
                  <h2 className={styles.emptyTitle}>Backend disconnected</h2>
                  <p className={styles.emptySubtitle}>Make sure the FastAPI server is running.</p>
               </>
            ) : !isConnected ? (
               <>
                  <div className={styles.emptyIcon}>
                    <Loader2 size={40} className={styles.toolSpinner} />
                  </div>
                  <h2 className={styles.emptyTitle}>Connecting...</h2>
                  <p className={styles.emptySubtitle}>Establishing secure connection to NeuralFlow...</p>
               </>
            ) : (
               <>
                  <motion.div
                    className={styles.emptyIcon}
                    animate={{ rotate: [0, 10, -10, 0] }}
                    transition={{ duration: 3, repeat: Infinity, repeatDelay: 2 }}
                  >
                    <Sparkles size={40} />
                  </motion.div>
                  <h2 className={styles.emptyTitle}>How can I help you today?</h2>
                  <p className={styles.emptySubtitle}>
                    I can check your calendar, read emails, manage GitHub, and more.
                  </p>
               </>
            )}

            <div className={styles.suggestions}>
              {suggestions.map((s, idx) => {
                const Icon = s.icon;
                return (
                  <motion.button
                    key={s.text}
                    className={styles.suggestionCard}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 + idx * 0.1 }}
                    whileHover={{ y: -4, borderColor: s.color }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => sendMessage(s.text)}
                  >
                    <Icon size={20} style={{ color: s.color }} />
                    <span>{s.text}</span>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        ) : (
          <div className={styles.messages}>
            <AnimatePresence initial={false}>
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  className={`${styles.message} ${styles[`message--${msg.role}`]}`}
                  initial={{ opacity: 0, y: 10, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                  layout
                >
                  <div className={styles.messageAvatar}>
                    {msg.role === "user" ? (
                      <User size={16} />
                    ) : (
                      <Bot size={16} />
                    )}
                  </div>
                  <div className={styles.messageContent}>
                    {/* Tool Calls */}
                    {msg.toolCalls && (
                      <div className={styles.toolCalls}>
                        {msg.toolCalls.map((tc) => (
                          <motion.div
                            key={tc.id}
                            className={styles.toolCall}
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                          >
                            <div className={styles.toolCallHeader}>
                              {tc.status === "calling" && (
                                <Loader2 size={14} className={styles.toolSpinner} />
                              )}
                              {tc.status === "success" && (
                                <CheckCircle2 size={14} style={{ color: "var(--success)" }} />
                              )}
                              {tc.status === "error" && (
                                <XCircle size={14} style={{ color: "var(--error)" }} />
                              )}
                              <Wrench size={12} />
                              <span className={styles.toolName}>{tc.toolName}</span>
                              <span className={styles.toolServer}>{tc.serverName}</span>
                            </div>
                            {tc.result && (
                              <div className={styles.toolResult}>{tc.result}</div>
                            )}
                          </motion.div>
                        ))}
                      </div>
                    )}
                    <div className={styles.messageText}>{msg.content}</div>
                    <div className={styles.messageTime}>
                      {msg.timestamp.toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Thinking indicator */}
            <AnimatePresence>
              {isThinking && (
                <motion.div
                  className={`${styles.message} ${styles["message--assistant"]}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                >
                  <div className={styles.messageAvatar}>
                    <Bot size={16} />
                  </div>
                  <div className={styles.thinking}>
                    <span className={styles.thinkingDot} />
                    <span className={styles.thinkingDot} />
                    <span className={styles.thinkingDot} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className={styles.inputArea}>
        <div className={styles.inputWrapper}>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask your AI assistant..."
            className={styles.input}
            id="chat-input"
            disabled={isThinking}
          />
          <motion.button
            className={styles.sendBtn}
            onClick={() => sendMessage()}
            disabled={!input.trim() || isThinking}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            id="btn-send-chat"
          >
            <Send size={18} />
          </motion.button>
        </div>
        <p className={styles.disclaimer}>
          NeuralFlow AI connects to your real accounts via MCP tools.
        </p>
      </div>
    </div>
  );
}


