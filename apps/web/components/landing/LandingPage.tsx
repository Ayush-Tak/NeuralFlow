"use client";

import { motion } from "framer-motion";
import { Sparkles, Workflow, Plug, MessageSquare, ArrowRight } from "lucide-react";
import styles from "./LandingPage.module.css";

export default function LandingPage() {
  return (
    <div className={styles.landing}>
      <div className={styles.hero}>
        <motion.div
          className={styles.badge}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Sparkles size={14} />
          AI-Powered Workflow Automation
        </motion.div>

        <motion.h1
          className={styles.title}
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
        >
          Automate Everything with{" "}
          <span className={styles.titleGradient}>NeuralFlow</span>
        </motion.h1>

        <motion.p
          className={styles.subtitle}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
        >
          Connect your Google, GitHub, and AI tools into powerful visual workflows.
          Build, run, and monitor automations — all from one place.
        </motion.p>

        <motion.a
          href="http://localhost:8000/auth/google/login"
          className={styles.cta}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5, type: "spring" }}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.97 }}
        >
          Get Started with Google
          <ArrowRight size={18} />
        </motion.a>

        <motion.div
          className={styles.features}
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.6 }}
        >
          <div className={styles.featureCard}>
            <div className={styles.featureIcon} style={{ background: "rgba(139, 92, 246, 0.15)", color: "#8b5cf6" }}>
              <MessageSquare size={24} />
            </div>
            <div className={styles.featureTitle}>AI Chat Assistant</div>
            <div className={styles.featureDesc}>
              Chat with an AI that can read your emails, check your calendar, and manage your GitHub repos — all through natural language.
            </div>
          </div>

          <div className={styles.featureCard}>
            <div className={styles.featureIcon} style={{ background: "rgba(6, 182, 212, 0.15)", color: "#06b6d4" }}>
              <Workflow size={24} />
            </div>
            <div className={styles.featureTitle}>Visual Flow Editor</div>
            <div className={styles.featureDesc}>
              Drag-and-drop workflow builder with triggers, AI agents, and integration nodes. Design complex automations visually.
            </div>
          </div>

          <div className={styles.featureCard}>
            <div className={styles.featureIcon} style={{ background: "rgba(34, 197, 94, 0.15)", color: "#22c55e" }}>
              <Plug size={24} />
            </div>
            <div className={styles.featureTitle}>Seamless Integrations</div>
            <div className={styles.featureDesc}>
              Connect Google Drive, Gmail, Calendar, and GitHub with one click. OAuth-based, secure, and always in sync.
            </div>
          </div>
        </motion.div>
      </div>

      <footer className={styles.footer}>
        Built with Next.js, FastAPI, and LangGraph — © {new Date().getFullYear()} NeuralFlow
      </footer>
    </div>
  );
}
