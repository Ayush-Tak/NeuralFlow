// Tool registry — single source of truth for all MCP tools available in the flow editor

export type ArgType = "string" | "number" | "select";

export interface ToolArg {
  name: string;
  type: ArgType;
  label: string;
  placeholder?: string;
  required?: boolean;
  options?: string[];
  defaultValue?: string;
}

export interface ToolDef {
  name: string;
  label: string;
  description: string;
  args: ToolArg[];
}

export interface IntegrationDef {
  label: string;
  tools: ToolDef[];
}

export const TOOL_REGISTRY: Record<string, IntegrationDef> = {
  "google-calendar": {
    label: "Google Calendar",
    tools: [
      {
        name: "list_events",
        label: "List Events",
        description: "List calendar events for a date",
        args: [
          { name: "date", type: "string", label: "Date (RFC3339)", placeholder: "2026-04-25T00:00:00Z", required: true },
          { name: "max_results", type: "number", label: "Max Results", placeholder: "10", defaultValue: "10" },
        ],
      },
      {
        name: "create_event",
        label: "Create Event",
        description: "Create a new calendar event",
        args: [
          { name: "title", type: "string", label: "Title", placeholder: "Meeting with team", required: true },
          { name: "start", type: "string", label: "Start (RFC3339)", placeholder: "2026-04-25T10:00:00Z", required: true },
          { name: "end", type: "string", label: "End (RFC3339)", placeholder: "2026-04-25T11:00:00Z", required: true },
          { name: "description", type: "string", label: "Description", placeholder: "Discuss project updates" },
        ],
      },
      {
        name: "delete_event",
        label: "Delete Event",
        description: "Delete a calendar event by ID",
        args: [
          { name: "event_id", type: "string", label: "Event ID", placeholder: "abc123 or $context.nodeId.result.id", required: true },
        ],
      },
    ],
  },
  gmail: {
    label: "Gmail",
    tools: [
      {
        name: "list_emails",
        label: "List Emails",
        description: "Search and list emails",
        args: [
          { name: "query", type: "string", label: "Search Query", placeholder: "is:unread", defaultValue: "is:unread" },
          { name: "max_results", type: "number", label: "Max Results", placeholder: "10", defaultValue: "10" },
        ],
      },
      {
        name: "read_email",
        label: "Read Email",
        description: "Read full email content by ID",
        args: [
          { name: "email_id", type: "string", label: "Email ID", placeholder: "$context.nodeId.result.0.id", required: true },
        ],
      },
      {
        name: "send_email",
        label: "Send Email",
        description: "Send an email through Gmail",
        args: [
          { name: "to", type: "string", label: "To", placeholder: "recipient@example.com", required: true },
          { name: "subject", type: "string", label: "Subject", placeholder: "Daily Digest", required: true },
          { name: "body", type: "string", label: "Body", placeholder: "Email body or $context.nodeId.result", required: true },
        ],
      },
    ],
  },
  "google-drive": {
    label: "Google Drive",
    tools: [
      {
        name: "list_files",
        label: "List Files",
        description: "List files in Google Drive",
        args: [
          { name: "query", type: "string", label: "Query Filter", placeholder: "name contains 'report'" },
          { name: "max_results", type: "number", label: "Max Results", placeholder: "10", defaultValue: "10" },
          { name: "order_by", type: "string", label: "Order By", placeholder: "modifiedTime desc", defaultValue: "modifiedTime desc" },
        ],
      },
      {
        name: "get_file",
        label: "Get File Info",
        description: "Get metadata for a specific file",
        args: [
          { name: "file_id", type: "string", label: "File ID", placeholder: "abc123 or $context.nodeId.result.0.id", required: true },
        ],
      },
      {
        name: "read_file",
        label: "Read File",
        description: "Read file text content (Docs, Sheets, text files)",
        args: [
          { name: "file_id", type: "string", label: "File ID", placeholder: "$context.nodeId.result.0.id", required: true },
        ],
      },
      {
        name: "search_files",
        label: "Search Files",
        description: "Full-text search across Drive",
        args: [
          { name: "query", type: "string", label: "Search Query", placeholder: "quarterly report", required: true },
          { name: "max_results", type: "number", label: "Max Results", placeholder: "10", defaultValue: "10" },
        ],
      },
    ],
  },
  github: {
    label: "GitHub",
    tools: [
      {
        name: "list_repos",
        label: "List Repos",
        description: "List your GitHub repositories",
        args: [
          { name: "max_results", type: "number", label: "Max Results", placeholder: "10", defaultValue: "10" },
        ],
      },
      {
        name: "list_issues",
        label: "List Issues",
        description: "List issues for a repository",
        args: [
          { name: "repo", type: "string", label: "Repository", placeholder: "owner/repo-name", required: true },
          { name: "state", type: "select", label: "State", options: ["open", "closed", "all"], defaultValue: "open" },
        ],
      },
      {
        name: "create_issue",
        label: "Create Issue",
        description: "Create a new GitHub issue",
        args: [
          { name: "repo", type: "string", label: "Repository", placeholder: "owner/repo-name", required: true },
          { name: "title", type: "string", label: "Title", placeholder: "Bug: something broke", required: true },
          { name: "body", type: "string", label: "Body", placeholder: "Issue description or $context.nodeId.result", required: true },
        ],
      },
      {
        name: "list_pull_requests",
        label: "List PRs",
        description: "List pull requests for a repository",
        args: [
          { name: "repo", type: "string", label: "Repository", placeholder: "owner/repo-name", required: true },
          { name: "state", type: "select", label: "State", options: ["open", "closed", "all"], defaultValue: "open" },
        ],
      },
      {
        name: "get_repo_info",
        label: "Repo Info",
        description: "Get metadata for a repository",
        args: [
          { name: "repo", type: "string", label: "Repository", placeholder: "owner/repo-name", required: true },
        ],
      },
    ],
  },
};
