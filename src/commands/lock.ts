import { existsSync, statSync } from "fs";
import { join } from "path";
import chalk from "chalk";
import { loadKey, encryptFile } from "../crypto.js";

interface LockOptions {
  env?: string;
  out?: string;
  quiet?: boolean;
}

export async function cmdLock(
  projectRoot: string,
  opts: LockOptions = {}
): Promise<void> {
  const envPath = join(projectRoot, opts.env ?? ".env");
  const lockPath = join(projectRoot, opts.out ?? ".env.locked");

  if (!existsSync(envPath)) {
    console.error(chalk.red(`  error  .env file not found: ${envPath}`));
    process.exit(1);
  }

  let key: ReturnType<typeof loadKey>;
  try {
    key = loadKey(projectRoot);
  } catch (err) {
    console.error(chalk.red(`  error  ${(err as Error).message}`));
    process.exit(1);
  }

  try {
    encryptFile(envPath, lockPath, key);
  } catch (err) {
    console.error(chalk.red(`  error  encryption failed: ${(err as Error).message}`));
    process.exit(1);
  }

  const size = statSync(lockPath).size;

  if (!opts.quiet) {
    console.log(chalk.green("  ok    encrypted:"), chalk.dim(envPath), "->", chalk.cyan(".env.locked"));
    console.log(chalk.dim(`        lock file size: ${size} bytes`));
    console.log(chalk.dim("\n        commit .env.locked to share with your team:"));
    console.log(chalk.cyan("        git add .env.locked && git commit -m 'chore: update env lockfile'\n"));
  } else {
    console.log(".env.locked updated.");
  }
}
