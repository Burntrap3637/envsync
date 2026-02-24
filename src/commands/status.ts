import { existsSync, readFileSync, statSync } from "fs";
import { join } from "path";
import chalk from "chalk";
import { loadKey, decryptToString, keyFilePath } from "../crypto.js";

function fmt(ms: number): string {
  return new Date(ms).toLocaleString();
}

export async function cmdStatus(projectRoot: string): Promise<void> {
  const envPath = join(projectRoot, ".env");
  const lockPath = join(projectRoot, ".env.locked");
  const keyPath = keyFilePath(projectRoot);

  console.log(chalk.bold("\nenvsync status\n"));

  // key
  if (existsSync(keyPath)) {
    console.log(chalk.green("  ok    key:"), chalk.dim(keyPath));
  } else {
    console.log(chalk.red("  error  key not found:"), chalk.dim(keyPath));
    console.log(chalk.dim("         run 'envsync init' or copy your team's key here."));
  }

  // files
  const hasEnv = existsSync(envPath);
  const hasLock = existsSync(lockPath);

  console.log(
    hasEnv ? chalk.green("  ok    .env:") : chalk.yellow("  warn  .env:"),
    hasEnv ? chalk.dim(`found  (modified ${fmt(statSync(envPath).mtimeMs)})`) : chalk.dim("not found")
  );

  console.log(
    hasLock ? chalk.green("  ok    .env.locked:") : chalk.yellow("  warn  .env.locked:"),
    hasLock ? chalk.dim(`found  (modified ${fmt(statSync(lockPath).mtimeMs)})`) : chalk.dim("not found")
  );

  // sync state
  if (hasEnv && hasLock && existsSync(keyPath)) {
    let key: ReturnType<typeof loadKey>;
    try {
      key = loadKey(projectRoot);
    } catch {
      console.log(chalk.red("\n  error  cannot check sync - key is malformed.\n"));
      return;
    }

    let lockedContent: string;
    try {
      lockedContent = decryptToString(lockPath, key);
    } catch {
      console.log(chalk.red("\n  error  cannot read .env.locked - decryption failed."));
      console.log(chalk.dim("         wrong key, or the file may be corrupted.\n"));
      return;
    }

    const localContent = readFileSync(envPath, "utf8");

    if (localContent === lockedContent) {
      console.log(chalk.green("\n  ok    in sync\n"));
    } else {
      const envMtime = statSync(envPath).mtimeMs;
      const lockMtime = statSync(lockPath).mtimeMs;

      if (envMtime > lockMtime) {
        console.log(chalk.yellow("\n  warn  local changes"));
        console.log(chalk.dim("        .env has been modified since last lock."));
        console.log(chalk.dim(`        run ${chalk.cyan("envsync lock")} to update .env.locked and commit it.\n`));
      } else {
        console.log(chalk.yellow("\n  warn  lock updated"));
        console.log(chalk.dim("        .env.locked is newer - your local .env may be stale."));
        console.log(chalk.dim(`        run ${chalk.cyan("envsync unlock")} to update your local .env.\n`));
      }

      console.log(chalk.dim(`        run ${chalk.cyan("envsync diff")} to see what changed.\n`));
    }
  } else {
    console.log(chalk.dim("\n  cannot determine sync status - missing files or key.\n"));
  }
}
