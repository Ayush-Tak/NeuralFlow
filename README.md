# NeuralFlow Lite

NeuralFlow Lite is a personal AI workflow automation platform that connects your Google and GitHub accounts to build, execute, and manage multi-step automation flows through an intuitive visual editor. It combines a real-time chat assistant with a drag-and-drop flow builder, allowing you to orchestrate actions across Gmail, Google Calendar, Google Drive, and GitHub from a single dashboard.

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Configuration](#configuration)
- [Usage](#usage)
- [API Reference](#api-reference)
- [Future Roadmap](#future-roadmap)
- [License](#license)

## Features

### Dashboard
- Real-time statistics: active flows, chat sessions, connected integrations, total executions
- Flow cards with status badges (active, paused, draft, error), node counts, and execution history
- One-click flow execution directly from the dashboard
- Quick Ask widget for instant AI queries

### Chat Assistant
- Conversational AI powered by Groq (LLaMA 3.3 70B)
- Tool-calling agent that chains API calls intelligently (e.g., list emails, then read the most recent one)
- Connected to all integrations: Gmail, Google Calendar, Google Drive, GitHub
- Real-time tool call indicators showing which integration is being used

### Flow Editor
- Visual drag-and-drop canvas built on React Flow
- Node types: Manual Trigger, Integration (Gmail, Calendar, Drive, GitHub), AI Agent
- Edge management with click-to-select and keyboard deletion
- Node configuration panel with tool selection and argument mapping
- Context passing between nodes using `$context.nodeId.result` references
- Auto-fill for common arguments (e.g., email IDs from upstream nodes)
- Execution results panel showing per-node success/error outputs

### Integrations
- Google OAuth 2.0: Gmail, Google Calendar, Google Drive
- GitHub OAuth: Repositories, Issues, Pull Requests
- Connect/disconnect from the settings panel with instant UI updates
- MCP (Model Context Protocol) servers for each integration

### Execution Engine
- Topological sort for DAG execution order
- Context propagation: each node receives all upstream results
- AI Agent nodes with structured JSON output for downstream consumption
- Token-safe context trimming for LLM calls
- Background async execution with polling-based result retrieval

## Architecture

```
neuralflow-lite/
|-- apps/
|   |-- api/          # FastAPI backend (Python)
|   |-- web/          # Next.js frontend (TypeScript)
|-- packages/
|   |-- mcp-servers/  # MCP tool servers per integration
|       |-- gmail/
|       |-- google-calendar/
|       |-- google-drive/
|       |-- github-server/
```

The backend exposes a REST API and a WebSocket endpoint for real-time chat. Each integration runs as an isolated MCP server subprocess, communicating via stdio. The flow executor orchestrates multi-step workflows by resolving node dependencies, executing tools through the MCP client, and chaining results.

## Tech Stack

**Frontend**
- Next.js 14 (App Router)
- React Flow (@xyflow/react)
- Framer Motion
- Zustand (state management with persistence)
- CSS Modules

**Backend**
- FastAPI with async support
- SQLAlchemy 2.0 (async, PostgreSQL)
- LangChain + LangGraph
- langchain-mcp-adapters (MCP client)
- Groq LLM (LLaMA 3.3 70B Versatile)
- FastMCP (MCP server framework)

**Infrastructure**
- Docker Compose (dev environment)
- PostgreSQL 16
- Turborepo (monorepo management)
- pnpm (package management)

## Getting Started

### Prerequisites

- Docker and Docker Compose
- Node.js 18+ and pnpm
- Python 3.11+
- A Groq API key (free at https://console.groq.com)
- Google OAuth credentials (Cloud Console)
- GitHub OAuth app credentials

### Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/neuralflow-lite.git
   cd neuralflow-lite
   ```

2. Configure environment variables:
   ```bash
   cp apps/api/.env.example apps/api/.env
   ```
   Fill in your API keys and OAuth credentials in `apps/api/.env`.

3. Start the development environment:
   ```bash
   docker-compose -f docker-compose.dev.yml up --build
   ```

4. Open the application:
   - Frontend: http://localhost:3000
   - API: http://localhost:8000
   - API docs: http://localhost:8000/docs

### First Run

1. Click "Continue with Google" or "Continue with GitHub" to authenticate
2. Connect your integrations from the settings panel (top-right avatar)
3. Try the chat: "What's on my calendar today?"
4. Create your first flow from the dashboard

## Project Structure

```
apps/api/
  main.py              # FastAPI application entry point
  config.py            # Settings loaded from environment
  agents/
    orchestrator.py    # LangGraph chat agent with tool routing
    prompts.py         # System prompts for the AI assistant
  db/
    database.py        # Async SQLAlchemy engine and session factory
  engine/
    executor.py        # Flow execution engine (DAG traversal, context resolution)
  models/
    user.py            # User model with OAuth token storage
    flow.py            # Flow model with JSONB nodes/edges
    execution.py       # Flow execution records
  routers/
    auth.py            # OAuth login, callback, user management
    flows.py           # CRUD + execution endpoints for flows
    ws.py              # WebSocket chat endpoint
  services/
    mcp_client.py      # Multi-server MCP client manager

apps/web/
  app/
    page.tsx           # Dashboard (main page)
    flows/[id]/page.tsx  # Flow editor page
    auth/callback/page.tsx  # OAuth callback handler
  components/
    chat/              # Chat interface components
    dashboard/         # Dashboard stats and flow cards
    flow/              # Flow editor, node types, config panel
    landing/           # Landing page
    layout/            # Sidebar, TopBar, settings panel
    ui/                # Shared UI components
  hooks/
    useAuthStore.ts    # Zustand auth + session state
  lib/
    api.ts             # API client
    ws.ts              # WebSocket client

packages/mcp-servers/
  gmail/server.py           # Gmail MCP tools
  google-calendar/server.py # Calendar MCP tools
  google-drive/server.py    # Drive MCP tools
  github-server/server.py   # GitHub MCP tools
```

## Configuration

### Environment Variables (apps/api/.env)

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Secret key for JWT token signing |
| `GROQ_API_KEY` | Groq API key for LLM access |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `GOOGLE_REDIRECT_URI` | Google OAuth callback URL |
| `GITHUB_CLIENT_ID` | GitHub OAuth app client ID |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth app secret |
| `GITHUB_REDIRECT_URI` | GitHub OAuth callback URL |

## Usage

### Building a Flow

1. Navigate to Flows and click "New Flow"
2. Drag nodes from the palette onto the canvas
3. Connect nodes by dragging from output handles to input handles
4. Click each node to configure its tool and arguments
5. Use `$context.nodeId.result.field` to pass data between nodes
6. Save and run the flow

### Context References

Nodes can reference upstream results using dot notation:
- `$context.integration-123.result.0.id` -- first item's ID from a list result
- `$context.aiAgent-456.result.title` -- a field from AI-generated JSON
- `$context` -- the entire upstream context object

The executor automatically resolves these references at runtime. If a reference resolves to null for an ID argument, the engine attempts to auto-fill from the most recent upstream result.

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/auth/me` | Current user with integration status |
| GET | `/auth/google/connect?token=` | Initiate Google OAuth |
| GET | `/auth/github/connect?token=` | Initiate GitHub OAuth |
| DELETE | `/auth/integrations/{provider}` | Disconnect an integration |
| GET | `/flows` | List user flows with execution counts |
| POST | `/flows` | Create a new flow |
| GET | `/flows/{id}` | Get flow details |
| PUT | `/flows/{id}` | Update a flow |
| DELETE | `/flows/{id}` | Delete a flow |
| POST | `/flows/{id}/execute` | Execute a flow |
| GET | `/flows/{id}/executions/{exec_id}` | Get execution results |
| WS | `/ws/chat` | Real-time chat with AI assistant |

## Future Roadmap

- Scheduled flow execution with cron-based triggers
- Webhook triggers for event-driven automation
- Conditional branching nodes (if/else logic based on upstream data)
- Loop nodes for batch processing (e.g., iterate over all unread emails)
- Flow execution history page with detailed logs and retry capability
- Collaborative flows with shared workspace support
- Additional integrations: Slack, Notion, Linear, Jira
- WebSocket-based real-time execution feedback (replacing polling)
- Flow templates and marketplace for pre-built automations
- Strict JSON schema validation for tool arguments
- Rate limiting and usage analytics dashboard

## License

This project is for educational and personal use.
