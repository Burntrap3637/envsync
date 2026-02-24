# 🔐 envsync

> Encrypt your `.env` file and safely commit it to git. Share secrets with your team without Slack DMs or leaked credentials.

---

## The problem

Managing `.env` files across a team is a mess:

- Sharing over Slack/email → secrets end up in search history forever
- No versioning → "which key did you update?" mystery
- No audit trail → you don't know when a value changed or who changed it
- Onboarding → new devs ping someone to send them the `.env` file

GitHub found **1 million+ leaked secrets** on public repos in early 2024. Most started as `.env` files shared carelessly.

## The solution

`envsync` encrypts your `.env` into a `.env.locked` file using **AES-256-GCM** that you can safely commit to git. Your team runs `envsync unlock` to restore their local copy. One key, shared securely once.

```
.env          ← secret, gitignored, auto-restored
.env.locked   ← encrypted, committed, safe to share
.envsync.key  ← master key, gitignored, shared once via 1Password/Bitwarden
```

---

## Install

```bash
npm install -g envsync
```

---

## Quickstart

```bash
# 1. Set up envsync in your project
envsync init

# 2. Encrypt your .env
envsync lock

# 3. Commit the lock file
git add .env.locked && git commit -m "chore: update env lockfile"

# 4. Teammate clones the repo, copies the key, then:
envsync unlock
```

---

## Commands

### `envsync init`

First-time setup. Generates an encryption key, updates `.gitignore`, and installs a `post-merge` git hook so `.env` auto-updates after `git pull`.

```
🔐 Initializing envsync

  ✔  Generated key: .envsync.key
     Share this file securely with teammates (1Password, Bitwarden, encrypted email). Never commit it.

  ✔  Updated .gitignore — added:
       .env
       .env.*
       !.env.example
       !.env.locked
       .envsync.key

  ✔  post-merge hook installed: .git/hooks/post-merge
```

---

### `envsync lock`

Encrypts `.env` → `.env.locked`. Run this after changing any secret.

```
🔒 Locking .env

  ✔  Encrypted: .env → .env.locked
     Lock file size: 312 bytes

     Commit .env.locked to share with your team:
       git add .env.locked && git commit -m 'chore: update env lockfile'
```

**Options:**
| Flag | Default | Description |
|------|---------|-------------|
| `--env <path>` | `.env` | Source env file |
| `--out <path>` | `.env.locked` | Output lock file |
| `-q, --quiet` | — | Suppress output |

---

### `envsync unlock`

Decrypts `.env.locked` → `.env`. Teammates run this after cloning, or `git pull` triggers it automatically via the installed hook.

```
🔓 Unlocking .env

  ✔  Decrypted: .env.locked → .env
     File mode: 600 (owner read/write only)
```

**Options:**
| Flag | Default | Description |
|------|---------|-------------|
| `--env <path>` | `.env` | Output env file |
| `--lockfile <path>` | `.env.locked` | Source lock file |
| `-f, --force` | — | Overwrite even if .env is newer |
| `-q, --quiet` | — | Suppress output |

---

### `envsync diff`

Shows what's different between your local `.env` and the committed `.env.locked`. Values are partially redacted so they don't appear in your terminal history.

```
📋 Diff: .env vs .env.locked

  - DATABASE_URL=po***
  + DATABASE_URL=po***
    REDIS_URL=re***
  + NEW_API_KEY=sk***

  Summary: +2 added  -1 removed

  Run `envsync lock` to update .env.locked with local changes.
```

---

### `envsync status`

Quick check: are you in sync, do you have local changes, or is the lock file newer than your `.env`?

```
📊 envsync status

  ✔  Key file: .envsync.key
  ✔  .env:        found  (modified 2/24/2026, 10:30:00 AM)
  ✔  .env.locked: found  (modified 2/24/2026, 10:28:00 AM)

  ⚠  Status: LOCAL CHANGES
     .env has been modified since last lock.
     Run `envsync lock` to update .env.locked and commit it.
```

---

## How it works

Every time you run `envsync lock`, envsync:

1. Reads your master key from `.envsync.key`
2. Generates a **random 32-byte salt** and **16-byte IV** (unique per lock)
3. Derives a per-lock key using **scrypt** (salt + master key) — so re-encrypting the same content produces different bytes every time
4. Encrypts with **AES-256-GCM** — authenticated encryption that detects tampering
5. Writes `MAGIC | salt | iv | authTag | ciphertext` to `.env.locked`

The `.envsync.key` is the only thing that needs to stay secret. Share it once via a password manager and you're done.

---

## Key rotation

```bash
# 1. Delete the old key
rm .envsync.key

# 2. Generate a new one
envsync init

# 3. Re-lock with the new key
envsync lock

# 4. Commit
git add .env.locked && git commit -m "chore: rotate envsync key"

# 5. Share the new .envsync.key with teammates
```

---

## Team onboarding checklist

- [ ] Install envsync: `npm install -g envsync`
- [ ] Clone the repo
- [ ] Get `.envsync.key` from the team (1Password, Bitwarden, etc.)
- [ ] Place it in the project root
- [ ] Run `envsync unlock`

After that, `.env` auto-updates on every `git pull` via the installed hook.

---

## Security notes

- `.envsync.key` **must never be committed**. envsync adds it to `.gitignore` automatically.
- AES-256-GCM provides **authenticated encryption** — if the lock file is modified (even one byte), decryption will fail with a clear error.
- Each `envsync lock` uses a fresh random salt and IV, so two locks of identical content produce different ciphertext.
- Key derivation uses **scrypt** (N=16384, r=8, p=1) — memory-hard and resistant to brute force.

---

## Contributing

PRs welcome! Please open an issue first if you're planning a large change.

```bash
git clone https://github.com/Burntrap3637/envsync
cd envsync
npm install
npm run build
node dist/cli.js --help
```

---

## License

MIT
