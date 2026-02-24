import { existsSync, readFileSync } from "fs";
import { join } from "path";
import chalk from "chalk";
import { createTwoFilesPatch, diffLines } from "diff";
import { loadKey, decryptToString } from "../crypto.js";

interface DiffOptions {
  env?: string;
  lockfile?: string;
  unified?: boolean; // use unified patch format instead of inline
}

// redact the value side of KEY=value lines so secrets don't appear in the terminal
function redactValue(line: string): string {
  return line.replace(/^([^#=\s][^=]*)=(.+)/, (_, key, val) => {
    const visible = val.length > 4 ? val.slice(0, 2) + "***" : "***";
    return `${key}=${visible}`;
  });
}

export async function cmdDiff(
  projectRoot: string,
  opts: DiffOptions = {}
): Promise<void> {
  const envPath = join(projectRoot, opts.env ?? ".env");
  const lockPath = join(projectRoot, opts.lockfile ?? ".env.locked");

  console.log(chalk.bold("\nenvsync diff\n"));

  const hasEnv = existsSync(envPath);
  const hasLock = existsSync(lockPath);

  if (!hasEnv && !hasLock) {
    console.log(chalk.yellow("  warn  neither .env nor .env.locked found."));
    console.log(chalk.dim("        run 'envsync init' to get started.\n"));
    return;
  }

  if (!hasLock) {
    console.log(chalk.yellow("  warn  .env.locked not found - nothing to compare against."));
    console.log(chalk.dim("        run 'envsync lock' to create the first lock.\n"));
    return;
  }

  if (!hasEnv) {
    console.log(chalk.yellow("  warn  .env not found locally."));
    console.log(chalk.dim("        run 'envsync unlock' to restore it.\n"));
    return;
  }

  let key: ReturnType<typeof loadKey>;
  try {
    key = loadKey(projectRoot);
  } catch (err) {
    console.error(chalk.red(`  error  ${(err as Error).message}`));
    process.exit(1);
  }

  let lockedContent: string;
  try {
    lockedContent = decryptToString(lockPath, key);
  } catch (err) {
    console.error(chalk.red(`  error  ${(err as Error).message}`));
    process.exit(1);
  }

  const localContent = readFileSync(envPath, "utf8");

  if (localContent === lockedContent) {
    console.log(chalk.green("  ok    in sync - .env matches .env.locked exactly.\n"));
    return;
  }

  if (opts.unified) {
    const patch = createTwoFilesPatch(
      ".env.locked",
      ".env (local)",
      lockedContent,
      localContent,
      "",
      ""
    );
    console.log(chalk.dim(patch));
    return;
  }

  // inline diff
  const changes = diffLines(lockedContent, localContent);
  let added = 0;
  let removed = 0;

  changes.forEach((part) => {
    const lines = part.value.split("\n").filter((l, i, arr) => {
      // drop the trailing empty string from split
      if (i === arr.length - 1 && l === "") return false;
      return true;
    });

    lines.forEach((line) => {
      const redacted = redactValue(line);
      if (part.added) {
        console.log(chalk.green("  + " + redacted));
        added++;
      } else if (part.removed) {
        console.log(chalk.red("  - " + redacted));
        removed++;
      } else {
        console.log(chalk.dim("    " + redacted));
      }
    });
  });

  console.log();
  console.log(chalk.bold("  summary:"), chalk.green(`+${added}`), chalk.red(`-${removed}`));
  console.log(chalk.dim("\n  run 'envsync lock' to update .env.locked with local changes.\n"));
}
