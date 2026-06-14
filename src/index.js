#!/usr/bin/env node

/**
 * Shared Context MCP Server
 *
 * Generic MCP server to sync and read a private shared-context
 * repository from GitHub. Configure it per-project via env vars.
 *
 * Compatible with: Claude Code, Cursor, Windsurf, and any MCP client.
 *
 * Required env vars:
 *   CONTEXT_REPO_URL      HTTPS Git URL of the context repo (public or private)
 *
 * Optional env vars:
 *   GITHUB_TOKEN          PAT with repo read scope — required for private repos
 *   CONTEXT_PROJECT_NAME  Display name shown in tool responses (default: "Shared")
 *   CONTEXT_REPO_PATH     Local path where the repo is cloned (default: ~/.shared-context/<project-slug>)
 *   CONTEXT_BRANCH        Branch to track (default: "main")
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import simpleGit from "simple-git";
import fs from "fs/promises";
import path from "path";
import { existsSync } from "fs";
import { homedir } from "os";

// ─── Config ──────────────────────────────────────────────────────────────────

const PROJECT_NAME = process.env.CONTEXT_PROJECT_NAME || "Shared";

// Slug used for the default local path (e.g. "My Project" → "my-project")
const projectSlug = PROJECT_NAME.toLowerCase().replace(/\s+/g, "-");

const CONFIG = {
  projectName: PROJECT_NAME,
  repoUrl: process.env.CONTEXT_REPO_URL,
  branch: process.env.CONTEXT_BRANCH || "main",
  localPath:
    process.env.CONTEXT_REPO_PATH ||
    path.join(homedir(), ".shared-context", projectSlug),
  allowedExtensions: [".md", ".txt", ".json", ".yaml", ".yml"],
};

// ─── Validation ───────────────────────────────────────────────────────────────

if (!CONFIG.repoUrl) {
  process.stderr.write(
    "[shared-context-mcp] ERROR: CONTEXT_REPO_URL environment variable is required.\n"
  );
  process.exit(1);
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

function buildAuthenticatedUrl(url) {
  const token = process.env.GITHUB_TOKEN;
  if (token && url.startsWith("https://") && !url.includes("@")) {
    return url.replace("https://", `https://${token}@`);
  }
  return url;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function ensureRepoExists() {
  const authUrl = buildAuthenticatedUrl(CONFIG.repoUrl);
  if (!existsSync(CONFIG.localPath)) {
    await fs.mkdir(CONFIG.localPath, { recursive: true });
    const git = simpleGit();
    await git.clone(authUrl, CONFIG.localPath, ["--branch", CONFIG.branch]);
    return { cloned: true };
  }
  // Keep remote URL in sync (handles token rotation and first run on existing clones)
  const git = simpleGit(CONFIG.localPath);
  await git.remote(["set-url", "origin", authUrl]);
  return { cloned: false };
}

async function getGitLog(git, count = 5) {
  const log = await git.log({ maxCount: count });
  return log.all.map((c) => ({
    hash: c.hash.slice(0, 7),
    message: c.message,
    author: c.author_name,
    date: c.date,
  }));
}

async function listAllowedFiles(dir, base = dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listAllowedFiles(fullPath, base)));
    } else {
      const ext = path.extname(entry.name).toLowerCase();
      if (CONFIG.allowedExtensions.includes(ext)) {
        files.push(path.relative(base, fullPath));
      }
    }
  }
  return files;
}

function notDownloaded() {
  return {
    content: [
      {
        type: "text",
        text: `⚠️ The ${CONFIG.projectName} context repo is not downloaded yet. Run update_shared_context first.`,
      },
    ],
  };
}

// ─── MCP Server ──────────────────────────────────────────────────────────────

const server = new McpServer({
  name: "shared-context",
  version: "1.0.0",
});

// ── Tool 1: update_shared_context ─────────────────────────────────────────────
server.tool(
  "update_shared_context",
  `Pull the latest changes from the ${CONFIG.projectName} shared context repository. Call this before reading any document to make sure you have the most recent version.`,
  {},
  async () => {
    try {
      const { cloned } = await ensureRepoExists();
      const git = simpleGit(CONFIG.localPath);

      let pullResult = null;
      if (!cloned) {
        await git.fetch("origin", CONFIG.branch);
        pullResult = await git.pull("origin", CONFIG.branch);
      }

      const commits = await getGitLog(git, 5);
      const files = await listAllowedFiles(CONFIG.localPath);

      const changed = pullResult?.summary?.changes ?? 0;
      const summary = cloned
        ? `✅ Cloned ${CONFIG.projectName} context repo for the first time.`
        : changed === 0
        ? `✅ Already up to date. No new changes in ${CONFIG.projectName} context.`
        : `✅ Updated. ${changed} file(s) changed in ${CONFIG.projectName} context.`;

      return {
        content: [
          {
            type: "text",
            text: [
              summary,
              "",
              `📦 Project:    ${CONFIG.projectName}`,
              `📁 Local path: ${CONFIG.localPath}`,
              `🌿 Branch:     ${CONFIG.branch}`,
              "",
              "📋 Recent commits:",
              ...commits.map((c) => `  ${c.hash} — ${c.date.slice(0, 10)} — ${c.message}`),
              "",
              `📄 Available files (${files.length}):`,
              ...files.map((f) => `  • ${f}`),
            ].join("\n"),
          },
        ],
      };
    } catch (err) {
      return {
        content: [
          {
            type: "text",
            text: `❌ Error updating ${CONFIG.projectName} context:\n${err.message}\n\nCheck that CONTEXT_REPO_URL is correct and your GitHub credentials are configured.`,
          },
        ],
      };
    }
  }
);

// ── Tool 2: list_context_files ────────────────────────────────────────────────
server.tool(
  "list_context_files",
  `List all available files in the ${CONFIG.projectName} shared context repository. Use this to explore what documents exist before reading them.`,
  {},
  async () => {
    try {
      if (!existsSync(CONFIG.localPath)) return notDownloaded();

      const git = simpleGit(CONFIG.localPath);
      const commits = await getGitLog(git, 1);
      const lastCommit = commits[0];
      const files = await listAllowedFiles(CONFIG.localPath);

      // Group by folder
      const grouped = {};
      for (const f of files) {
        const folder = path.dirname(f) === "." ? "📁 root" : `📁 ${path.dirname(f)}`;
        if (!grouped[folder]) grouped[folder] = [];
        grouped[folder].push(path.basename(f));
      }

      const lines = [
        `📦 ${CONFIG.projectName} — Shared Context`,
        `🔖 Last commit: ${lastCommit?.hash} — ${lastCommit?.date?.slice(0, 10)} — ${lastCommit?.message}`,
        "",
      ];

      for (const [folder, folderFiles] of Object.entries(grouped)) {
        lines.push(folder);
        folderFiles.forEach((f) => lines.push(`   • ${f}`));
        lines.push("");
      }

      return { content: [{ type: "text", text: lines.join("\n") }] };
    } catch (err) {
      return { content: [{ type: "text", text: `❌ Error: ${err.message}` }] };
    }
  }
);

// ── Tool 3: read_context_file ─────────────────────────────────────────────────
server.tool(
  "read_context_file",
  `Read the content of a specific file from the ${CONFIG.projectName} shared context repository. Pass the relative file path (e.g. 'business-logic/core-rules.md').`,
  {
    filePath: z
      .string()
      .describe("Relative path of the file inside the context repo (e.g. 'business-logic/core-rules.md')"),
  },
  async ({ filePath }) => {
    try {
      if (!existsSync(CONFIG.localPath)) return notDownloaded();

      const fullPath = path.resolve(CONFIG.localPath, filePath);

      // Security: prevent path traversal
      if (!fullPath.startsWith(path.resolve(CONFIG.localPath))) {
        return { content: [{ type: "text", text: "❌ Invalid path." }] };
      }

      const ext = path.extname(filePath).toLowerCase();
      if (!CONFIG.allowedExtensions.includes(ext)) {
        return {
          content: [
            {
              type: "text",
              text: `❌ File type not allowed. Valid extensions: ${CONFIG.allowedExtensions.join(", ")}`,
            },
          ],
        };
      }

      const content = await fs.readFile(fullPath, "utf-8");
      const git = simpleGit(CONFIG.localPath);
      const fileLog = await git.log({ file: filePath, maxCount: 1 });
      const lastChange = fileLog.latest;

      const header = lastChange
        ? `📄 ${filePath}\n🔖 Last modified: ${lastChange.hash.slice(0, 7)} — ${lastChange.date.slice(0, 10)} — ${lastChange.message}\n${"─".repeat(60)}\n\n`
        : `📄 ${filePath}\n${"─".repeat(60)}\n\n`;

      return { content: [{ type: "text", text: header + content }] };
    } catch (err) {
      if (err.code === "ENOENT") {
        return {
          content: [
            {
              type: "text",
              text: `❌ File not found: ${filePath}\n\nUse list_context_files to see available files.`,
            },
          ],
        };
      }
      return { content: [{ type: "text", text: `❌ Error: ${err.message}` }] };
    }
  }
);

// ── Tool 4: get_context_status ────────────────────────────────────────────────
server.tool(
  "get_context_status",
  `Check whether the local ${CONFIG.projectName} context repo is up to date with the remote. Shows local vs remote commit, and how many commits are pending.`,
  {},
  async () => {
    try {
      if (!existsSync(CONFIG.localPath)) return notDownloaded();

      const git = simpleGit(CONFIG.localPath);
      await git.remote(["set-url", "origin", buildAuthenticatedUrl(CONFIG.repoUrl)]);
      await git.fetch("origin", CONFIG.branch);

      const localLog = await getGitLog(git, 1);
      const remoteHash = await git.revparse([`origin/${CONFIG.branch}`]);
      const localHash = await git.revparse(["HEAD"]);

      const isUpToDate = remoteHash.trim() === localHash.trim();
      const pendingCount = isUpToDate
        ? 0
        : parseInt(
            (await git.raw(["rev-list", "--count", `HEAD..origin/${CONFIG.branch}`])).trim()
          );

      const lines = [
        isUpToDate
          ? `✅ ${CONFIG.projectName} context is up to date.`
          : `⚠️  ${pendingCount} new commit(s) available. Run update_shared_context to pull them.`,
        "",
        `📦 Project:       ${CONFIG.projectName}`,
        `📍 Local commit:  ${localHash.trim().slice(0, 7)} — ${localLog[0]?.message}`,
        `☁️  Remote commit: ${remoteHash.trim().slice(0, 7)}`,
        `🌿 Branch:        ${CONFIG.branch}`,
        `📁 Local path:    ${CONFIG.localPath}`,
      ];

      return { content: [{ type: "text", text: lines.join("\n") }] };
    } catch (err) {
      return { content: [{ type: "text", text: `❌ Error: ${err.message}` }] };
    }
  }
);

// ─── Start ────────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
