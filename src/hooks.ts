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
# Auto-unlock .env after git pull/merge if a lock file is present
if command -v envsync &> /dev/null; then
  if [ -f ".env.locked" ]; then
    echo "🔓 envsync: updating .env from .env.locked..."
    envsync unlock --quiet || echo "⚠️  envsync: unlock failed (key missing?)"
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
    throw new Error(
      `No .git/hooks directory found. Is this a git repository?`
    );
  }

  // Hook already has our marker — skip
  if (existsSync(hookPath)) {
    const content = readFileSync(hookPath, "utf8");
    if (content.includes(HOOK_MARKER)) {
      return { status: "skipped", path: hookPath };
    }
    // Existing hook without our code — append
    writeFileSync(hookPath, content + "\n" + POST_MERGE_HOOK);
    chmodSync(hookPath, 0o755);
    return { status: "updated", path: hookPath };
  }

  // Fresh install
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

  // If the hook is ONLY our code, delete the lines we added
  const lines = content.split("\n");
  const markerIndex = lines.findIndex((l) => l.trim() === HOOK_MARKER);
  if (markerIndex === -1) return false;

  // Keep everything before our block
  const cleaned = lines.slice(0, markerIndex).join("\n").trimEnd();
  if (cleaned.length <= "#!/bin/sh".length) {
    // Only the shebang left — remove the whole file? No, leave it empty-ish.
    writeFileSync(hookPath, "#!/bin/sh\n");
  } else {
    writeFileSync(hookPath, cleaned + "\n");
  }
  return true;
}
