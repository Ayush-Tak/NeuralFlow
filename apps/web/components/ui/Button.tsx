"use client";

import { motion, type HTMLMotionProps } from "framer-motion";
import styles from "./Button.module.css";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends Omit<HTMLMotionProps<"button">, "size"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
  loading?: boolean;
  fullWidth?: boolean;
  children: React.ReactNode;
}

export default function Button({
  variant = "primary",
  size = "md",
  icon,
  iconRight,
  loading = false,
  fullWidth = false,
  children,
  className = "",
  disabled,
  ...props
}: ButtonProps) {
  return (
    <motion.button
      className={`${styles.btn} ${styles[`btn--${variant}`]} ${styles[`btn--${size}`]} ${
        fullWidth ? styles["btn--full"] : ""
      } ${loading ? styles["btn--loading"] : ""} ${className}`}
      whileHover={!disabled && !loading ? { scale: 1.02, y: -1 } : {}}
      whileTap={!disabled && !loading ? { scale: 0.98 } : {}}
      transition={{ duration: 0.15 }}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <span className={styles.spinner} />}
      {!loading && icon && <span className={styles.icon}>{icon}</span>}
      <span className={styles.label}>{children}</span>
      {iconRight && <span className={styles.icon}>{iconRight}</span>}
    </motion.button>
  );
}
