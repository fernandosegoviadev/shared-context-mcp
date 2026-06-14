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
| `CONTEXT_REPO_URL` | ✅ yes | — | HTTPS URL of the context repo (public or private) |
| `GITHUB_TOKEN` | private repos | — | PAT with `repo` (or `contents:read`) scope |
| `CONTEXT_PROJECT_NAME` | no | `"Shared"` | Display name shown in tool responses |
| `CONTEXT_REPO_PATH` | no | `~/.shared-context/<project-slug>` | Local path where the repo is cloned |
| `CONTEXT_BRANCH` | no | `main` | Branch to track |

### Authentication for private repos

Set `GITHUB_TOKEN` alongside `CONTEXT_REPO_URL`. The server injects the token into the HTTPS URL automatically — you never embed credentials in the URL itself.

```json
"env": {
  "CONTEXT_REPO_URL": "https://github.com/YOUR_ORG/my-context.git",
  "GITHUB_TOKEN": "ghp_xxxxxxxxxxxxxxxxxxxx"
}
```

Generate a token at **GitHub → Settings → Developer settings → Personal access tokens**.  
Required scope: `repo` for classic tokens, or `contents: read` for fine-grained tokens.

> Public repos work without any token — just set `CONTEXT_REPO_URL` and omit `GITHUB_TOKEN`.

---

## Configuration per agent

### Claude Code

Per-project (`.claude/settings.json` inside each repo):
```json
{
  "mcpServers": {
    "myproject-context": {
      "command": "node",
      "args": ["/Users/you/tools/shared-context-mcp/src/index.js"],
      "env": {
        "CONTEXT_REPO_URL": "https://github.com/your-org/myproject-shared-context.git",
        "GITHUB_TOKEN": "ghp_xxxxxxxxxxxxxxxxxxxx",
        "CONTEXT_PROJECT_NAME": "MyProject"
      }
    }
  }
}
```

Global (`~/.claude/settings.json`) — applies to all your projects:
```json
{
  "mcpServers": {
    "myproject-context": {
      "command": "node",
      "args": ["/Users/you/tools/shared-context-mcp/src/index.js"],
      "env": {
        "CONTEXT_REPO_URL": "https://github.com/your-org/myproject-shared-context.git",
        "GITHUB_TOKEN": "ghp_xxxxxxxxxxxxxxxxxxxx",
        "CONTEXT_PROJECT_NAME": "MyProject"
      }
    },
    "otherproject-context": {
      "command": "node",
      "args": ["/Users/you/tools/shared-context-mcp/src/index.js"],
      "env": {
        "CONTEXT_REPO_URL": "https://github.com/your-org/otherproject-shared-context.git",
        "GITHUB_TOKEN": "ghp_xxxxxxxxxxxxxxxxxxxx",
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
    "myproject-context": {
      "command": "node",
      "args": ["/Users/you/tools/shared-context-mcp/src/index.js"],
      "env": {
        "CONTEXT_REPO_URL": "https://github.com/your-org/myproject-shared-context.git",
        "GITHUB_TOKEN": "ghp_xxxxxxxxxxxxxxxxxxxx",
        "CONTEXT_PROJECT_NAME": "MyProject"
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
    "myproject-context": {
      "command": "node",
      "args": ["/Users/you/tools/shared-context-mcp/src/index.js"],
      "env": {
        "CONTEXT_REPO_URL": "https://github.com/your-org/myproject-shared-context.git",
        "GITHUB_TOKEN": "ghp_xxxxxxxxxxxxxxxxxxxx",
        "CONTEXT_PROJECT_NAME": "MyProject"
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
- Pass the token via `GITHUB_TOKEN` env var — never embed it directly in `CONTEXT_REPO_URL`.
- The server prevents path traversal: it can only read files inside the cloned repo directory.
- Allowed file extensions: `.md`, `.txt`, `.json`, `.yaml`, `.yml`.

> **Important — do not commit MCP config files to git.**  
> Files like `.claude/settings.json`, `.cursor/mcp.json`, and `~/.codeium/windsurf/mcp_config.json` may contain `GITHUB_TOKEN` and other credentials. Add them to your `.gitignore` to prevent accidental exposure:
>
> ```gitignore
> # MCP server config (may contain secrets)
> .claude/settings.json
> .cursor/mcp.json
> ```
>
> For global config files stored under your home directory (`~/.claude/settings.json`, `~/.cursor/mcp.json`, `~/.codeium/windsurf/mcp_config.json`), make sure those directories are not inside any tracked repository.
