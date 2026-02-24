import { existsSync } from "fs";
import { join } from "path";
import chalk from "chalk";
import { generateKey, keyFilePath } from "../crypto.js";
import { updateGitignore } from "../gitignore.js";
import { installHook } from "../hooks.js";

export async function cmdInit(projectRoot: string): Promise<void> {
  console.log(chalk.bold("\n🔐 Initializing envsync\n"));

  // ── 1. Key file ─────────────────────────────────────────────────────────────
  const keyPath = keyFilePath(projectRoot);

  if (existsSync(keyPath)) {
    console.log(chalk.yellow("  ⚠  Key file already exists:"), chalk.dim(keyPath));
    console.log(chalk.dim("     Skipping key generation — delete it first to rotate.\n"));
  } else {
    generateKey(projectRoot);
    console.log(chalk.green("  ✔  Generated key:"), chalk.dim(keyPath));
    console.log(
      chalk.dim(
        "     Share this file securely with teammates (1Password, Bitwarden,\n" +
        "     encrypted email). Never commit it.\n"
      )
    );
  }

  // ── 2. .gitignore ────────────────────────────────────────────────────────────
  const { added, skipped } = updateGitignore(projectRoot);

  if (added.length > 0) {
    console.log(chalk.green("  ✔  Updated .gitignore — added:"));
    added.forEach((e) => console.log(chalk.dim(`       ${e}`)));
  } else {
    console.log(chalk.yellow("  ⚠  .gitignore already up to date."));
  }
  if (skipped.length > 0) {
    console.log(chalk.dim(`     Skipped (already present): ${skipped.join(", ")}`));
  }
  console.log();

  // ── 3. Git hook ──────────────────────────────────────────────────────────────
  try {
    const { status, path: hookPath } = installHook(projectRoot);
    const icon = status === "skipped" ? "⚠" : "✔";
    const color = status === "skipped" ? chalk.yellow : chalk.green;
    console.log(color(`  ${icon}  post-merge hook ${status}:`), chalk.dim(hookPath));
    console.log(
      chalk.dim(
        "     Your .env will auto-update after git pull when a .env.locked exists.\n"
      )
    );
  } catch (err) {
    console.log(chalk.yellow("  ⚠  Skipped git hook:"), (err as Error).message);
  }

  // ── 4. Next steps ────────────────────────────────────────────────────────────
  const hasEnv = existsSync(join(projectRoot, ".env"));
  console.log(chalk.bold("  Next steps:"));
  if (hasEnv) {
    console.log(`    ${chalk.cyan("envsync lock")}    — encrypt your .env into .env.locked`);
  } else {
    console.log(chalk.dim("    Create a .env file, then run:"));
    console.log(`    ${chalk.cyan("envsync lock")}    — encrypt your .env into .env.locked`);
  }
  console.log(`    ${chalk.cyan("envsync status")}  — check sync status`);
  console.log(`    ${chalk.cyan("envsync diff")}    — see what changed\n`);
}
