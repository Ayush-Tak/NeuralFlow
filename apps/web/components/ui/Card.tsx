"use client";

import { motion } from "framer-motion";
import styles from "./Card.module.css";

interface CardProps {
  children: React.ReactNode;
  variant?: "default" | "glass" | "gradient-border" | "interactive";
  padding?: "sm" | "md" | "lg" | "none";
  className?: string;
  onClick?: () => void;
  id?: string;
}

export default function Card({
  children,
  variant = "default",
  padding = "md",
  className = "",
  onClick,
  id,
}: CardProps) {
  const Component = onClick ? motion.div : "div";
  const motionProps = onClick
    ? {
        whileHover: { y: -2, transition: { duration: 0.2 } },
        whileTap: { scale: 0.99 },
      }
    : {};

  return (
    <Component
      className={`${styles.card} ${styles[`card--${variant}`]} ${styles[`card--pad-${padding}`]} ${className}`}
      onClick={onClick}
      id={id}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      {...motionProps}
    >
      {children}
    </Component>
  );
}
