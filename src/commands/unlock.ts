import { existsSync, statSync } from "fs";
import { join } from "path";
import chalk from "chalk";
import { loadKey, decryptFile } from "../crypto.js";

interface UnlockOptions {
  env?: string;
  lockfile?: string;
  quiet?: boolean;
  force?: boolean;
}

export async function cmdUnlock(
  projectRoot: string,
  opts: UnlockOptions = {}
): Promise<void> {
  const envPath = join(projectRoot, opts.env ?? ".env");
  const lockPath = join(projectRoot, opts.lockfile ?? ".env.locked");

  if (!existsSync(lockPath)) {
    console.error(chalk.red(`  error  lock file not found: ${lockPath}`));
    console.error(chalk.dim("         run 'envsync lock' first."));
    process.exit(1);
  }

  // warn if .env is newer than the lock file and --force is not set
  if (existsSync(envPath) && !opts.force) {
    const envMtime = statSync(envPath).mtimeMs;
    const lockMtime = statSync(lockPath).mtimeMs;

    if (envMtime > lockMtime) {
      console.warn(chalk.yellow("  warn   .env is newer than .env.locked."));
      console.warn(chalk.dim("         it may have uncommitted changes."));
      console.warn(chalk.dim("         use --force to overwrite, or run 'envsync lock' first."));
      console.log();
      process.exit(1);
    }
  }

  let key: ReturnType<typeof loadKey>;
  try {
    key = loadKey(projectRoot);
  } catch (err) {
    console.error(chalk.red(`  error  ${(err as Error).message}`));
    process.exit(1);
  }

  try {
    decryptFile(lockPath, envPath, key);
  } catch (err) {
    console.error(chalk.red(`  error  ${(err as Error).message}`));
    process.exit(1);
  }

  if (!opts.quiet) {
    console.log(chalk.green("  ok    decrypted:"), chalk.dim(".env.locked"), "->", chalk.cyan(envPath));
    console.log(chalk.dim("        file mode: 600\n"));
  } else {
    console.log(".env updated.");
  }
}
