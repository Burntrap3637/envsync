import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

const GITIGNORE_ENTRIES = [
  "# envsync - local secrets (never commit these)",
  ".env",
  ".env.*",
  "!.env.example",
  "!.env.locked",
  ".envsync.key",
];

export function updateGitignore(projectRoot: string): {
  added: string[];
  skipped: string[];
} {
  const gitignorePath = join(projectRoot, ".gitignore");

  let existing = "";
  if (existsSync(gitignorePath)) {
    existing = readFileSync(gitignorePath, "utf8");
  }

  const existingLines = new Set(existing.split("\n").map((l) => l.trim()));

  const added: string[] = [];
  const skipped: string[] = [];
  const newLines: string[] = [];

  for (const entry of GITIGNORE_ENTRIES) {
    if (entry.startsWith("#") || !existingLines.has(entry)) {
      newLines.push(entry);
      if (!entry.startsWith("#")) added.push(entry);
    } else {
      skipped.push(entry);
    }
  }

  if (newLines.length > 0) {
    const section = "\n" + newLines.join("\n") + "\n";
    writeFileSync(gitignorePath, existing + section);
  }

  return { added, skipped };
}

export function isGitignored(projectRoot: string, file: string): boolean {
  const gitignorePath = join(projectRoot, ".gitignore");
  if (!existsSync(gitignorePath)) return false;
  const lines = readFileSync(gitignorePath, "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));
  return lines.some((pattern) => {
    if (pattern.startsWith("!")) return false;
    return file === pattern || file.endsWith(`/${pattern}`);
  });
}
