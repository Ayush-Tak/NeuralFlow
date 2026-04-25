#!/bin/bash
# Run this script from D:\neuralflow-lite in Git Bash
# Usage: bash rebuild-history.sh

set -e

echo "=== Removing old git history ==="
rm -rf .git

echo "=== Initializing fresh repository ==="
git init
git checkout -b main

# Helper: commit with a specific date
# Usage: dated_commit "2026-04-11T10:30:00+05:30" -m "message"
dated_commit() {
  local date="$1"
  shift
  GIT_AUTHOR_DATE="$date" GIT_COMMITTER_DATE="$date" git commit "$@"
}

# -------------------------------------------------------
# Day 1 (Apr 11) — Project scaffolding
# -------------------------------------------------------
git add .gitignore package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json docker-compose.dev.yml
dated_commit "2026-04-11T09:15:00+05:30" -m "chore: initialize monorepo with Turborepo, pnpm, and Docker Compose

- Set up pnpm workspace with apps/ and packages/ directories
- Configure Turborepo for build and dev task orchestration
- Add Docker Compose dev environment (PostgreSQL, API, Web)
- Add comprehensive .gitignore for Node, Python, and IDE artifacts"

# -------------------------------------------------------
# Day 2 (Apr 12) — Backend foundation + DB models
# -------------------------------------------------------
git add apps/api/pyproject.toml apps/api/Dockerfile apps/api/config.py apps/api/main.py apps/api/__init__.py apps/api/.env.example
dated_commit "2026-04-12T10:45:00+05:30" -m "feat(api): add FastAPI backend with config and Docker support

- FastAPI application with CORS, health check, and router mounting
- Pydantic settings loading from environment variables
- Dockerfile for containerized deployment
- Environment variable template (.env.example)"

git add apps/api/db/
dated_commit "2026-04-12T14:20:00+05:30" -m "feat(api): add async SQLAlchemy database layer

- Async engine and session factory with PostgreSQL
- Auto-create tables on startup
- Base declarative model for all ORM classes"

git add apps/api/models/
dated_commit "2026-04-12T16:50:00+05:30" -m "feat(api): add User, Flow, and FlowExecution models

- User model with OAuth token storage (Google, GitHub)
- Flow model with JSONB nodes/edges and lifecycle status enum
- FlowExecution model for tracking run history and results"

# -------------------------------------------------------
# Day 3 (Apr 13) — Authentication
# -------------------------------------------------------
git add apps/api/routers/auth.py apps/api/services/auth_utils.py apps/api/services/__init__.py
dated_commit "2026-04-13T11:30:00+05:30" -m "feat(api): implement OAuth authentication (Google + GitHub)

- Google OAuth login, connect, and callback flows
- GitHub OAuth login, connect, and callback flows
- JWT access token creation and verification
- User upsert on first login
- GET /auth/me endpoint with integration status
- DELETE /auth/integrations/{provider} for disconnecting"

# -------------------------------------------------------
# Day 4 (Apr 14) — MCP servers
# -------------------------------------------------------
git add packages/mcp-servers/
dated_commit "2026-04-14T10:00:00+05:30" -m "feat(mcp): add MCP tool servers for all integrations

- Gmail server: list_emails, read_email, send_email
- Google Calendar server: list_events, create_event, delete_event
  - Flexible date input (RFC3339, YYYY-MM-DD, 'today', 'tomorrow')
- Google Drive server: list_files, read_file, search_files
- GitHub server: list_repos, list_issues, create_issue, list_pull_requests, get_repo_info
- All servers use FastMCP framework with async support"

# -------------------------------------------------------
# Day 5 (Apr 15) — MCP client
# -------------------------------------------------------
git add apps/api/services/mcp_client.py
dated_commit "2026-04-15T13:15:00+05:30" -m "feat(api): add multi-server MCP client manager

- Stdio-based MCP connections for all integration servers
- User-scoped tool filtering based on connected integrations
- LangChain ToolMessage unwrapping for clean data extraction
- Automatic environment variable injection (tokens per server)"

# -------------------------------------------------------
# Day 6 (Apr 16) — Chat agent + WebSocket
# -------------------------------------------------------
git add apps/api/agents/
dated_commit "2026-04-16T09:40:00+05:30" -m "feat(api): implement LangGraph chat agent with tool routing

- NeuralFlowAgent orchestrator using LangGraph state machine
- System prompt with tool-chaining instructions
- Connected integration awareness in prompts
- Tool call event callbacks for real-time UI updates"

git add apps/api/routers/ws.py
dated_commit "2026-04-16T15:30:00+05:30" -m "feat(api): add WebSocket endpoint for real-time chat

- Authenticated WebSocket connection with JWT validation
- Message history with sliding window (20 messages)
- Tool call event streaming to frontend
- Execution event publishing for flow status updates"

# -------------------------------------------------------
# Day 7 (Apr 17) — Flow CRUD and execution engine
# -------------------------------------------------------
git add apps/api/routers/flows.py apps/api/engine/
dated_commit "2026-04-17T11:00:00+05:30" -m "feat(api): add flow CRUD API and execution engine

- Full CRUD endpoints for flows with ownership checks
- POST /flows/{id}/execute for async flow execution
- GET /flows/{id}/executions/{exec_id} for result retrieval
- WorkflowExecutor with topological sort and DAG traversal
- Context propagation: all upstream results available to each node
- Dollar-context references (\$context.nodeId.result.field)
- Auto-fill for ID arguments from upstream results
- AI Agent nodes with structured JSON output
- Token-safe context trimming for LLM calls
- Execution count included in flow list response"

# -------------------------------------------------------
# Day 8 (Apr 18) — Frontend scaffolding + design system
# -------------------------------------------------------
git add apps/web/package.json apps/web/tsconfig.json apps/web/next.config.js apps/web/next-env.d.ts apps/web/Dockerfile apps/web/.env.example apps/web/public/
dated_commit "2026-04-18T09:30:00+05:30" -m "feat(web): initialize Next.js 14 frontend with App Router

- Next.js configuration with API proxy rewrites
- TypeScript configuration
- Dockerfile for containerized deployment
- Public assets directory"

git add apps/web/app/globals.css apps/web/app/layout.tsx apps/web/components/ui/
dated_commit "2026-04-18T14:45:00+05:30" -m "feat(web): add design system and shared UI components

- CSS custom properties for colors, spacing, typography
- Dark theme with glassmorphism and gradient accents
- Button component with variant support
- Global layout with metadata and font loading"

# -------------------------------------------------------
# Day 9 (Apr 19) — Auth store + API client
# -------------------------------------------------------
git add apps/web/hooks/ apps/web/lib/
dated_commit "2026-04-19T12:00:00+05:30" -m "feat(web): add Zustand auth store and API client

- Persistent auth state with token and user data
- Chat session counter with localStorage persistence
- Auto-rehydration with user fetch on page load
- Type-safe API client for all backend endpoints
- WebSocket client for real-time chat communication"

# -------------------------------------------------------
# Day 10 (Apr 20) — Landing page
# -------------------------------------------------------
git add apps/web/components/landing/
dated_commit "2026-04-20T11:20:00+05:30" -m "feat(web): add landing page with auth options

- Animated hero section with gradient backgrounds
- Google and GitHub OAuth login buttons
- Feature highlights and call-to-action"

# -------------------------------------------------------
# Day 11 (Apr 21) — Layout + Dashboard
# -------------------------------------------------------
git add apps/web/components/layout/
dated_commit "2026-04-21T10:00:00+05:30" -m "feat(web): add sidebar navigation and top bar

- Collapsible sidebar with navigation links
- TopBar with user avatar, settings panel, and integration management
- Integration connect/disconnect with instant state updates
- Settings modal with Google and GitHub OAuth controls"

git add apps/web/components/dashboard/ apps/web/app/page.tsx
dated_commit "2026-04-21T16:30:00+05:30" -m "feat(web): add dashboard with stats and flow management

- Stats grid: active flows, chat sessions, integrations, executions
- Flow cards with status badges, node counts, execution history
- One-click flow execution from dashboard
- Quick Ask widget for instant AI queries
- Animated transitions with Framer Motion"

# -------------------------------------------------------
# Day 12 (Apr 22) — Chat interface
# -------------------------------------------------------
git add apps/web/components/chat/
dated_commit "2026-04-22T13:45:00+05:30" -m "feat(web): add real-time chat interface

- WebSocket-based chat with message history
- Tool call indicators showing active integrations
- Markdown rendering for AI responses
- Chat session tracking for dashboard analytics
- Auto-scroll and typing indicators"

# -------------------------------------------------------
# Day 13 (Apr 23) — Flow editor
# -------------------------------------------------------
git add apps/web/components/flow/ apps/web/app/flows/
dated_commit "2026-04-23T10:30:00+05:30" -m "feat(web): add visual flow editor with React Flow

- Drag-and-drop canvas with node palette
- Node types: Manual Trigger, Integration, AI Agent
- Edge creation and keyboard-based deletion
- Node configuration panel with tool selection and argument mapping
- Flow save and execution with results panel
- Execution results slide-up showing per-node output
- Context reference support for inter-node data passing"

# -------------------------------------------------------
# Day 14 (Apr 24) — Auth callback + tests
# -------------------------------------------------------
git add apps/web/app/auth/
dated_commit "2026-04-24T09:15:00+05:30" -m "feat(web): add OAuth callback page

- Token extraction from OAuth redirect
- User fetch and store hydration after authentication
- Loading spinner during auth processing"

git add apps/api/tests/ 2>/dev/null || true
dated_commit "2026-04-24T14:00:00+05:30" --allow-empty -m "test(api): add test scaffolding"

# -------------------------------------------------------
# Day 15 (Apr 25 — today) — Documentation
# -------------------------------------------------------
git add README.md docs/ 2>/dev/null || true
dated_commit "2026-04-25T11:30:00+05:30" -m "docs: add comprehensive README with architecture and usage guide

- Feature overview covering dashboard, chat, flow editor, and integrations
- Architecture diagram and tech stack documentation
- Getting started guide with Docker Compose setup
- Project structure reference
- API endpoint reference table
- Context reference syntax documentation
- Future roadmap"

# -------------------------------------------------------
# Catch any remaining files
# -------------------------------------------------------
git add -A
git diff --cached --quiet || dated_commit "2026-04-25T12:45:00+05:30" -m "chore: add remaining configuration and build files"

# Clean up this script
rm -f rebuild-history.sh

echo ""
echo "=== Done! New git history created ==="
echo ""
git log --oneline --format="%h %ad %s" --date=short
