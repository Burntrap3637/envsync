import { existsSync } from "fs";
import { join } from "path";
import chalk from "chalk";
import { generateKey, keyFilePath } from "../crypto.js";
import { updateGitignore } from "../gitignore.js";
import { installHook } from "../hooks.js";

export async function cmdInit(projectRoot: string): Promise<void> {
  console.log(chalk.bold("\nenvsync init\n"));

  // key file
  const keyPath = keyFilePath(projectRoot);

  if (existsSync(keyPath)) {
    console.log(chalk.yellow("  warn  key file already exists:"), chalk.dim(keyPath));
    console.log(chalk.dim("        delete it first to rotate.\n"));
  } else {
    generateKey(projectRoot);
    console.log(chalk.green("  ok    key generated:"), chalk.dim(keyPath));
    console.log(chalk.dim("        share with teammates via a password manager. never commit it.\n"));
  }

  // .gitignore
  const { added, skipped } = updateGitignore(projectRoot);

  if (added.length > 0) {
    console.log(chalk.green("  ok    .gitignore updated - added:"));
    added.forEach((e) => console.log(chalk.dim(`          ${e}`)));
  } else {
    console.log(chalk.yellow("  warn  .gitignore already up to date."));
  }
  if (skipped.length > 0) {
    console.log(chalk.dim(`        skipped (already present): ${skipped.join(", ")}`));
  }
  console.log();

  // git hook
  try {
    const { status, path: hookPath } = installHook(projectRoot);
    const color = status === "skipped" ? chalk.yellow : chalk.green;
    const label = status === "skipped" ? "warn" : "ok";
    console.log(color(`  ${label}   post-merge hook ${status}:`), chalk.dim(hookPath));
    console.log(chalk.dim("        .env will auto-update after git pull if .env.locked is present.\n"));
  } catch (err) {
    console.log(chalk.yellow("  warn  skipped git hook:"), (err as Error).message);
  }

  // next steps
  const hasEnv = existsSync(join(projectRoot, ".env"));
  console.log(chalk.bold("  next steps:"));
  if (!hasEnv) {
    console.log(chalk.dim("    create a .env file, then run:"));
  }
  console.log(`    ${chalk.cyan("envsync lock")}    - encrypt your .env into .env.locked`);
  console.log(`    ${chalk.cyan("envsync status")}  - check sync status`);
  console.log(`    ${chalk.cyan("envsync diff")}    - see what changed\n`);
}
