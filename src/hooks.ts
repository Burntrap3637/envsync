import {
  existsSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  chmodSync,
} from "fs";
import { join } from "path";

const HOOK_MARKER = "# envsync-hook";

const POST_MERGE_HOOK = `#!/bin/sh
${HOOK_MARKER}
# auto-unlock .env after git pull if a lock file is present
if command -v envsync &> /dev/null; then
  if [ -f ".env.locked" ]; then
    echo "envsync: updating .env from .env.locked..."
    envsync unlock --quiet || echo "envsync: unlock failed (key missing?)"
  fi
fi
`;

export function installHook(projectRoot: string): {
  status: "installed" | "updated" | "skipped";
  path: string;
} {
  const hooksDir = join(projectRoot, ".git", "hooks");
  const hookPath = join(hooksDir, "post-merge");

  if (!existsSync(hooksDir)) {
    throw new Error("no .git/hooks directory found. is this a git repository?");
  }

  // already installed - skip
  if (existsSync(hookPath)) {
    const content = readFileSync(hookPath, "utf8");
    if (content.includes(HOOK_MARKER)) {
      return { status: "skipped", path: hookPath };
    }
    // existing hook without our code - append
    writeFileSync(hookPath, content + "\n" + POST_MERGE_HOOK);
    chmodSync(hookPath, 0o755);
    return { status: "updated", path: hookPath };
  }

  // fresh install
  mkdirSync(hooksDir, { recursive: true });
  writeFileSync(hookPath, POST_MERGE_HOOK);
  chmodSync(hookPath, 0o755);
  return { status: "installed", path: hookPath };
}

export function removeHook(projectRoot: string): boolean {
  const hookPath = join(projectRoot, ".git", "hooks", "post-merge");
  if (!existsSync(hookPath)) return false;

  const content = readFileSync(hookPath, "utf8");
  if (!content.includes(HOOK_MARKER)) return false;

  // strip the lines we added, keep anything that was there before
  const lines = content.split("\n");
  const markerIndex = lines.findIndex((l) => l.trim() === HOOK_MARKER);
  if (markerIndex === -1) return false;

  const cleaned = lines.slice(0, markerIndex).join("\n").trimEnd();
  writeFileSync(hookPath, cleaned.length <= "#!/bin/sh".length ? "#!/bin/sh\n" : cleaned + "\n");
  return true;
}
