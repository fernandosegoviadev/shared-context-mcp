# shared-context-mcp

Generic MCP server to sync and read a **private shared-context repository** from GitHub.  
Configure it per-project via environment variables — one binary, many projects.

Compatible with **Claude Code, Cursor, Windsurf**, and any MCP-compatible client.

---

## Tools

| Tool | Natural language triggers |
|------|--------------------------|
| `update_shared_context` | "bring me the latest context", "pull shared context", "update the context" |
| `get_context_status` | "am I on the latest version?", "are there any new changes in the context?" |
| `list_context_files` | "what files are in the context?", "show the structure of the context" |
| `read_context_file` | "read the business rules", "open the context roadmap" |

---

## Installation

```bash
git clone https://github.com/YOUR_USER/shared-context-mcp.git ~/tools/shared-context-mcp
cd ~/tools/shared-context-mcp
npm install
```

---

## Environment variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `CONTEXT_REPO_URL` | ✅ yes | — | Git URL of the private context repo |
| `CONTEXT_PROJECT_NAME` | no | `"Shared"` | Display name shown in tool responses |
| `CONTEXT_REPO_PATH` | no | `~/.shared-context/<project-slug>` | Local path where the repo is cloned |
| `CONTEXT_BRANCH` | no | `main` | Branch to track |

### Authentication

For private repos, use SSH (recommended if your machine has keys set up):
```
CONTEXT_REPO_URL=git@github.com:YOUR_ORG/my-context.git
```

Or HTTPS with a token:
```
CONTEXT_REPO_URL=https://YOUR_TOKEN@github.com/YOUR_ORG/my-context.git
```

---

## Configuration per agent

### Claude Code

Per-project (`.claude/settings.json` inside each repo):
```json
{
  "mcpServers": {
    "tasksolver-context": {
      "command": "node",
      "args": ["/Users/you/tools/shared-context-mcp/src/index.js"],
      "env": {
        "CONTEXT_REPO_URL": "git@github.com:your-org/tasksolver-shared-context.git",
        "CONTEXT_PROJECT_NAME": "TaskSolver"
      }
    }
  }
}
```

Global (`~/.claude/settings.json`) — applies to all your projects:
```json
{
  "mcpServers": {
    "tasksolver-context": {
      "command": "node",
      "args": ["/Users/you/tools/shared-context-mcp/src/index.js"],
      "env": {
        "CONTEXT_REPO_URL": "git@github.com:your-org/tasksolver-shared-context.git",
        "CONTEXT_PROJECT_NAME": "TaskSolver"
      }
    },
    "otherproject-context": {
      "command": "node",
      "args": ["/Users/you/tools/shared-context-mcp/src/index.js"],
      "env": {
        "CONTEXT_REPO_URL": "git@github.com:your-org/otherproject-shared-context.git",
        "CONTEXT_PROJECT_NAME": "OtherProject"
      }
    }
  }
}
```

### Cursor

`.cursor/mcp.json` (per-project) or `~/.cursor/mcp.json` (global):
```json
{
  "mcpServers": {
    "tasksolver-context": {
      "command": "node",
      "args": ["/Users/you/tools/shared-context-mcp/src/index.js"],
      "env": {
        "CONTEXT_REPO_URL": "git@github.com:your-org/tasksolver-shared-context.git",
        "CONTEXT_PROJECT_NAME": "TaskSolver"
      }
    }
  }
}
```

### Windsurf

`~/.codeium/windsurf/mcp_config.json`:
```json
{
  "mcpServers": {
    "tasksolver-context": {
      "command": "node",
      "args": ["/Users/you/tools/shared-context-mcp/src/index.js"],
      "env": {
        "CONTEXT_REPO_URL": "git@github.com:your-org/tasksolver-shared-context.git",
        "CONTEXT_PROJECT_NAME": "TaskSolver"
      }
    }
  }
}
```

---

## Recommended structure for your context repo

```
my-project-shared-context/
├── CHANGELOG.md
├── README.md
├── business-logic/
│   └── core-rules.md
├── features/
│   └── roadmap.md
├── architecture/
│   └── overview.md
└── ai-instructions/
    └── global-context.md
```

---

## Security

- Keep the context repo **private** on GitHub.
- Never hardcode GitHub tokens in the config — use env vars or SSH keys.
- The server prevents path traversal: it can only read files inside the cloned repo directory.
- Allowed file extensions: `.md`, `.txt`, `.json`, `.yaml`, `.yml`.
