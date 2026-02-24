import { existsSync, readFileSync, statSync } from "fs";
import { join } from "path";
import chalk from "chalk";
import { loadKey, decryptToString, keyFilePath } from "../crypto.js";

function fmt(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleString();
}

export async function cmdStatus(projectRoot: string): Promise<void> {
  const envPath = join(projectRoot, ".env");
  const lockPath = join(projectRoot, ".env.locked");
  const keyPath = keyFilePath(projectRoot);

  console.log(chalk.bold("\n📊 envsync status\n"));

  // ── Key ──────────────────────────────────────────────────────────────────────
  if (existsSync(keyPath)) {
    console.log(chalk.green("  ✔  Key file:"), chalk.dim(keyPath));
  } else {
    console.log(chalk.red("  ✖  Key file not found:"), chalk.dim(keyPath));
    console.log(chalk.dim("     Run \`envsync init\` or copy your team's key here."));
  }

  // ── Files ────────────────────────────────────────────────────────────────────
  const hasEnv = existsSync(envPath);
  const hasLock = existsSync(lockPath);

  console.log(
    hasEnv ? chalk.green("  ✔  .env:") : chalk.yellow("  ⚠  .env:"),
    hasEnv
      ? chalk.dim(`found  (modified ${fmt(statSync(envPath).mtimeMs)})`)
      : chalk.dim("not found")
  );

  console.log(
    hasLock ? chalk.green("  ✔  .env.locked:") : chalk.yellow("  ⚠  .env.locked:"),
    hasLock
      ? chalk.dim(`found  (modified ${fmt(statSync(lockPath).mtimeMs)})`)
      : chalk.dim("not found")
  );

  // ── Sync state ───────────────────────────────────────────────────────────────
  if (hasEnv && hasLock && existsSync(keyPath)) {
    let key: ReturnType<typeof loadKey>;
    try {
      key = loadKey(projectRoot);
    } catch {
      console.log(chalk.red("\n  ✖  Cannot check sync — key is malformed."));
      console.log();
      return;
    }

    let lockedContent: string;
    try {
      lockedContent = decryptToString(lockPath, key);
    } catch {
      console.log(chalk.red("\n  ✖  Cannot read .env.locked — decryption failed."));
      console.log(chalk.dim("     Wrong key, or the file may be corrupted."));
      console.log();
      return;
    }

    const localContent = readFileSync(envPath, "utf8");

    if (localContent === lockedContent) {
      console.log(chalk.green("\n  ✔  Status: IN SYNC"));
      console.log(chalk.dim("     Your .env matches .env.locked exactly.\n"));
    } else {
      const envMtime = statSync(envPath).mtimeMs;
      const lockMtime = statSync(lockPath).mtimeMs;

      if (envMtime > lockMtime) {
        console.log(chalk.yellow("\n  ⚠  Status: LOCAL CHANGES"));
        console.log(
          chalk.dim("     .env has been modified since last lock.\n") +
          chalk.dim(`     Run ${chalk.cyan("envsync lock")} to update .env.locked and commit it.\n`)
        );
      } else {
        console.log(chalk.yellow("\n  ⚠  Status: LOCK UPDATED"));
        console.log(
          chalk.dim("     .env.locked is newer — your local .env may be stale.\n") +
          chalk.dim(`     Run ${chalk.cyan("envsync unlock")} to update your local .env.\n`)
        );
      }

      console.log(chalk.dim(`     Run ${chalk.cyan("envsync diff")} to see what changed.\n`));
    }
  } else {
    console.log(chalk.dim("\n  (Cannot determine sync status — missing files or key.)\n"));
  }
}
