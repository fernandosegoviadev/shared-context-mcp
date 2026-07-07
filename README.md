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

Claude Code stores MCP server configuration differently depending on the platform:

- **macOS / Linux**: per-project via `.claude/settings.json`, or global via `~/.claude/settings.json`
- **Windows**: configuration must be registered via the CLI — `settings.json` is not read for MCPs on Windows

#### macOS / Linux — via settings.json

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
    }
  }
}
```

#### Windows — via CLI

On Windows, Claude Code reads MCP configuration from `%USERPROFILE%\.claude.json` (per project),
which must be registered using the `claude mcp add` command. **Editing `settings.json` manually has no effect on Windows.**

Run this from the root of your project (the directory you open with Claude Code):

```powershell
cd D:\your-projects\myproject

claude mcp add myproject-context "C:\path\to\node.exe" "C:\path\to\shared-context-mcp\src\index.js" `
  --env CONTEXT_REPO_URL=https://github.com/your-org/myproject-shared-context.git `
  --env GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx `
  --env CONTEXT_PROJECT_NAME=MyProject
```

> **Important:** run the command from the project directory you intend to use with Claude Code.
> The entry is registered under that specific project path in `%USERPROFILE%\.claude.json`.
> Running it from a different folder will register the MCP under the wrong project.

To verify the server is connected, open Claude Code and run `/mcp`. You should see:

```
task-solver-context · ✔ connected · 4 tools
```

To remove a server:

```powershell
claude mcp remove myproject-context
```

#### Connecting multiple repositories of the same project (Windows)

A common setup is having one shared context repo that feeds several sub-projects (API, frontend, mobile app, etc.). Since Claude Code registers MCPs per project folder, you run `claude mcp add` once for each repo, all pointing to the same MCP server and the same context repo.

Suppose your project is structured like this:

```
D:\Projects\MyApp\
├── mcp\shared-context-mcp\     ← the MCP server (this repo)
├── api\myapp-api\              ← backend
├── app\myapp-app\              ← mobile app
└── web\myapp-web\              ← frontend
```

And you have a single shared context repo at `https://github.com/your-org/myapp-shared-context.git`.

Run the following in PowerShell to register the MCP in all three projects at once:

```powershell
cd "D:\Projects\MyApp\api\myapp-api"
claude mcp add myapp-context "C:\path\to\node.exe" "D:\Projects\MyApp\mcp\shared-context-mcp\src\index.js" --env CONTEXT_REPO_URL=https://github.com/your-org/myapp-shared-context.git --env GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx --env CONTEXT_PROJECT_NAME=MyApp

cd "D:\Projects\MyApp\app\myapp-app"
claude mcp add myapp-context "C:\path\to\node.exe" "D:\Projects\MyApp\mcp\shared-context-mcp\src\index.js" --env CONTEXT_REPO_URL=https://github.com/your-org/myapp-shared-context.git --env GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx --env CONTEXT_PROJECT_NAME=MyApp

cd "D:\Projects\MyApp\web\myapp-web"
claude mcp add myapp-context "C:\path\to\node.exe" "D:\Projects\MyApp\mcp\shared-context-mcp\src\index.js" --env CONTEXT_REPO_URL=https://github.com/your-org/myapp-shared-context.git --env GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx --env CONTEXT_PROJECT_NAME=MyApp
```

All three point to the same MCP binary and the same context repo. The local clone is shared too — the server clones the repo once to `~/.shared-context/myapp` and all projects read from that same directory.

After running the commands, open each project folder in Claude Code and verify with `/mcp`:

```
myapp-context · ✔ connected · 4 tools
```

---

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