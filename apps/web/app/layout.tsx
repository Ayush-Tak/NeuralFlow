import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NeuralFlow — AI Personal Assistant & Workflow Builder",
  description:
    "Your AI-powered personal assistant with a visual workflow builder. Connect Google Calendar, Gmail, Drive, and GitHub.",
  keywords: [
    "AI assistant",
    "workflow automation",
    "MCP",
    "personal assistant",
    "NeuralFlow",
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
