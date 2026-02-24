#!/usr/bin/env node
import { Command } from "commander";
import { resolve } from "path";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

import { cmdInit } from "./commands/init.js";
import { cmdLock } from "./commands/lock.js";
import { cmdUnlock } from "./commands/unlock.js";
import { cmdDiff } from "./commands/diff.js";
import { cmdStatus } from "./commands/status.js";

// Read version from package.json
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const pkg = JSON.parse(
  readFileSync(join(__dirname, "..", "package.json"), "utf8")
);

const program = new Command();

program
  .name("envsync")
  .description(
    "🔐 Safely encrypt and sync .env files across your team using git\n\n" +
    "  Workflow:\n" +
    "    1. envsync init          — first-time setup (generates key, updates .gitignore)\n" +
    "    2. envsync lock          — encrypt .env → .env.locked  (commit this)\n" +
    "    3. envsync unlock        — decrypt .env.locked → .env  (teammates run this)\n" +
    "    4. envsync diff          — see what changed\n" +
    "    5. envsync status        — check if you're in sync"
  )
  .version(pkg.version);

// ── init ──────────────────────────────────────────────────────────────────────
program
  .command("init")
  .description("Set up envsync in this project (generate key, update .gitignore, install git hook)")
  .action(async () => {
    const root = resolve(process.cwd());
    await cmdInit(root);
  });

// ── lock ──────────────────────────────────────────────────────────────────────
program
  .command("lock")
  .description("Encrypt .env → .env.locked")
  .option("--env <path>", "Path to .env file", ".env")
  .option("--out <path>", "Path to output lock file", ".env.locked")
  .option("-q, --quiet", "Suppress output")
  .action(async (opts) => {
    const root = resolve(process.cwd());
    await cmdLock(root, opts);
  });

// ── unlock ────────────────────────────────────────────────────────────────────
program
  .command("unlock")
  .description("Decrypt .env.locked → .env")
  .option("--env <path>", "Path to output .env file", ".env")
  .option("--lockfile <path>", "Path to lock file", ".env.locked")
  .option("-q, --quiet", "Suppress output")
  .option("-f, --force", "Overwrite .env even if it is newer than .env.locked")
  .action(async (opts) => {
    const root = resolve(process.cwd());
    await cmdUnlock(root, opts);
  });

// ── diff ──────────────────────────────────────────────────────────────────────
program
  .command("diff")
  .description("Show differences between local .env and .env.locked")
  .option("--env <path>", "Path to .env file", ".env")
  .option("--lockfile <path>", "Path to lock file", ".env.locked")
  .option("-u, --unified", "Show output in unified patch format")
  .action(async (opts) => {
    const root = resolve(process.cwd());
    await cmdDiff(root, opts);
  });

// ── status ────────────────────────────────────────────────────────────────────
program
  .command("status")
  .description("Show sync status: in sync, local changes, or lock updated")
  .action(async () => {
    const root = resolve(process.cwd());
    await cmdStatus(root);
  });

program.parse(process.argv);
