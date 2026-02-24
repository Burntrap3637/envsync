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

  if (!opts.quiet) {
    console.log(chalk.bold("\n🔓 Unlocking .env\n"));
  }

  if (!existsSync(lockPath)) {
    console.error(chalk.red(`  ✖  Lock file not found: ${lockPath}`));
    console.error(chalk.dim("     Run \`envsync lock\` first."));
    process.exit(1);
  }

  // Warn if .env already exists and --force not set
  if (existsSync(envPath) && !opts.force) {
    const envMtime = statSync(envPath).mtimeMs;
    const lockMtime = statSync(lockPath).mtimeMs;

    if (envMtime > lockMtime) {
      console.warn(
        chalk.yellow("  ⚠  Your .env is newer than .env.locked.") +
        chalk.dim("\n     It may have uncommitted changes.\n") +
        chalk.dim(`     Use ${chalk.bold("--force")} to overwrite anyway, or run ${chalk.bold("envsync lock")} first.`)
      );
      if (!opts.quiet) console.log();
      process.exit(1);
    }
  }

  let key: ReturnType<typeof loadKey>;
  try {
    key = loadKey(projectRoot);
  } catch (err) {
    console.error(chalk.red(`  ✖  ${(err as Error).message}`));
    process.exit(1);
  }

  try {
    decryptFile(lockPath, envPath, key);
  } catch (err) {
    console.error(chalk.red(`  ✖  ${(err as Error).message}`));
    process.exit(1);
  }

  if (!opts.quiet) {
    console.log(chalk.green("  ✔  Decrypted:"), chalk.dim(".env.locked"), "→", chalk.cyan(envPath));
    console.log(chalk.dim(`     File mode: 600 (owner read/write only)\n`));
  } else {
    console.log("🔓 .env updated.");
  }
}
