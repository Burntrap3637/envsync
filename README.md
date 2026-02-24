# envsync

encrypt your `.env` file and safely commit it to git. share secrets with your team without slack dms or leaked credentials.

---

## the problem

managing `.env` files across a team is a mess:

- sharing over slack/email - secrets end up in search history forever
- no versioning - "which key did you update?" mystery
- no audit trail - you don't know when a value changed or who changed it
- onboarding - new devs ping someone to send them the `.env` file

github found over 1 million leaked secrets on public repos in early 2024. most started as `.env` files shared carelessly.

## the solution

`envsync` encrypts your `.env` into a `.env.locked` file using aes-256-gcm that you can safely commit to git. your team runs `envsync unlock` to restore their local copy. one key, shared securely once.

```
.env          - secret, gitignored, auto-restored
.env.locked   - encrypted, committed, safe to share
.envsync.key  - master key, gitignored, shared once via 1password/bitwarden
```

---

## install

```bash
npm install -g envsync
```

---

## quickstart

```bash
# 1. set up envsync in your project
envsync init

# 2. encrypt your .env
envsync lock

# 3. commit the lock file
git add .env.locked && git commit -m "chore: update env lockfile"

# 4. teammate clones the repo, copies the key, then:
envsync unlock
```

---

## commands

### `envsync init`

first-time setup. generates an encryption key, updates `.gitignore`, and installs a `post-merge` git hook so `.env` auto-updates after `git pull`.

```
envsync init

  ok    key generated: .envsync.key
        share with teammates via a password manager. never commit it.

  ok    .gitignore updated - added:
          .env
          .env.*
          !.env.example
          !.env.locked
          .envsync.key

  ok    post-merge hook installed: .git/hooks/post-merge
```

---

### `envsync lock`

encrypts `.env` -> `.env.locked`. run this after changing any secret.

```
  ok    encrypted: .env -> .env.locked
        lock file size: 312 bytes

        commit .env.locked to share with your team:
        git add .env.locked && git commit -m 'chore: update env lockfile'
```

options:

| flag | default | description |
|------|---------|-------------|
| `--env <path>` | `.env` | source env file |
| `--out <path>` | `.env.locked` | output lock file |
| `-q, --quiet` | - | suppress output |

---

### `envsync unlock`

decrypts `.env.locked` -> `.env`. teammates run this after cloning, or `git pull` triggers it automatically via the installed hook.

```
  ok    decrypted: .env.locked -> .env
        file mode: 600
```

options:

| flag | default | description |
|------|---------|-------------|
| `--env <path>` | `.env` | output env file |
| `--lockfile <path>` | `.env.locked` | source lock file |
| `-f, --force` | - | overwrite even if .env is newer |
| `-q, --quiet` | - | suppress output |

---

### `envsync diff`

shows what's different between your local `.env` and the committed `.env.locked`. values are partially redacted so they don't appear in your terminal history.

```
envsync diff

  - DATABASE_URL=po***
  + DATABASE_URL=po***
    REDIS_URL=re***
  + NEW_API_KEY=sk***

  summary: +2 -1

  run 'envsync lock' to update .env.locked with local changes.
```

---

### `envsync status`

quick check: are you in sync, do you have local changes, or is the lock file newer than your `.env`?

```
envsync status

  ok    key: .envsync.key
  ok    .env:        found  (modified 2/24/2026, 10:30:00 am)
  ok    .env.locked: found  (modified 2/24/2026, 10:28:00 am)

  warn  local changes
        .env has been modified since last lock.
        run 'envsync lock' to update .env.locked and commit it.
```

---

## how it works

every time you run `envsync lock`, envsync:

1. reads your master key from `.envsync.key`
2. generates a random 32-byte salt and 16-byte iv (unique per lock)
3. derives a per-lock key using scrypt (salt + master key) - so re-encrypting the same content produces different bytes every time
4. encrypts with aes-256-gcm - authenticated encryption that detects tampering
5. writes `magic | salt | iv | authTag | ciphertext` to `.env.locked`

the `.envsync.key` is the only thing that needs to stay secret. share it once via a password manager and you're done.

---

## key rotation

```bash
# delete the old key
rm .envsync.key

# generate a new one
envsync init

# re-lock with the new key
envsync lock

# commit
git add .env.locked && git commit -m "chore: rotate envsync key"

# share the new .envsync.key with teammates
```

---

## team onboarding

- install envsync: `npm install -g envsync`
- clone the repo
- get `.envsync.key` from the team (1password, bitwarden, etc.)
- place it in the project root
- run `envsync unlock`

after that, `.env` auto-updates on every `git pull` via the installed hook.

---

## security notes

- `.envsync.key` must never be committed. envsync adds it to `.gitignore` automatically.
- aes-256-gcm provides authenticated encryption - if the lock file is modified (even one byte), decryption will fail with a clear error.
- each `envsync lock` uses a fresh random salt and iv, so two locks of identical content produce different ciphertext.
- key derivation uses scrypt (n=16384, r=8, p=1) - memory-hard and resistant to brute force.

---

## contributing

prs welcome. open an issue first if you're planning a large change.

```bash
git clone https://github.com/Burntrap3637/envsync
cd envsync
npm install
npm run build
node dist/cli.js --help
```

---

## license

mit
