import {
  randomBytes,
  createCipheriv,
  createDecipheriv,
  scryptSync,
} from "crypto";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

const KEY_FILE = ".envsync.key";
const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const SALT_LENGTH = 32;
const AUTH_TAG_LENGTH = 16;
const MAGIC = Buffer.from("ENVSYNC1"); // 8-byte magic header to identify lock files

// key management

export function keyFilePath(projectRoot: string): string {
  return join(projectRoot, KEY_FILE);
}

export function generateKey(projectRoot: string): string {
  const key = randomBytes(KEY_LENGTH).toString("hex");
  writeFileSync(keyFilePath(projectRoot), key + "\n", { mode: 0o600 });
  return key;
}

export function loadKey(projectRoot: string): Buffer {
  const path = keyFilePath(projectRoot);
  if (!existsSync(path)) {
    throw new Error(
      `no key file found at ${path}.\nrun 'envsync init' first, or copy the team key to this location.`
    );
  }
  const raw = readFileSync(path, "utf8").trim();
  if (!/^[0-9a-f]{64}$/i.test(raw)) {
    throw new Error(`key file ${path} is malformed. expected 64 hex chars.`);
  }
  return Buffer.from(raw, "hex");
}

// encryption
//
// lock file binary layout:
//   [8]   magic    "ENVSYNC1"
//   [32]  salt     used with scrypt to derive a per-lock key
//   [16]  iv       aes-gcm initialisation vector
//   [16]  authTag  aes-gcm authentication tag
//   [...]  ciphertext

export function encrypt(plaintext: string, masterKey: Buffer): Buffer {
  const salt = randomBytes(SALT_LENGTH);
  const iv = randomBytes(IV_LENGTH);

  // derive a per-lock key so the same content always produces different ciphertext
  const derivedKey = scryptSync(masterKey, salt, KEY_LENGTH);

  const cipher = createCipheriv(ALGORITHM, derivedKey, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return Buffer.concat([MAGIC, salt, iv, authTag, ciphertext]);
}

export function decrypt(data: Buffer, masterKey: Buffer): string {
  let offset = 0;

  // check magic header
  const magic = data.subarray(offset, offset + MAGIC.length);
  offset += MAGIC.length;
  if (!magic.equals(MAGIC)) {
    throw new Error(
      "lock file is not a valid envsync file or is corrupted (bad magic bytes)."
    );
  }

  const salt = data.subarray(offset, offset + SALT_LENGTH);
  offset += SALT_LENGTH;

  const iv = data.subarray(offset, offset + IV_LENGTH);
  offset += IV_LENGTH;

  const authTag = data.subarray(offset, offset + AUTH_TAG_LENGTH);
  offset += AUTH_TAG_LENGTH;

  const ciphertext = data.subarray(offset);

  const derivedKey = scryptSync(masterKey, salt, KEY_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, derivedKey, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(authTag);

  try {
    return (
      decipher.update(ciphertext).toString("utf8") +
      decipher.final().toString("utf8")
    );
  } catch {
    throw new Error(
      "decryption failed - wrong key, or the lock file has been tampered with."
    );
  }
}

// file helpers

export function encryptFile(
  envPath: string,
  lockPath: string,
  masterKey: Buffer
): void {
  if (!existsSync(envPath)) {
    throw new Error(`source file not found: ${envPath}`);
  }
  const plaintext = readFileSync(envPath, "utf8");
  const locked = encrypt(plaintext, masterKey);
  writeFileSync(lockPath, locked);
}

export function decryptFile(
  lockPath: string,
  envPath: string,
  masterKey: Buffer
): void {
  if (!existsSync(lockPath)) {
    throw new Error(`lock file not found: ${lockPath}`);
  }
  const data = readFileSync(lockPath);
  const plaintext = decrypt(data, masterKey);
  writeFileSync(envPath, plaintext, { mode: 0o600 });
}

export function decryptToString(lockPath: string, masterKey: Buffer): string {
  if (!existsSync(lockPath)) {
    throw new Error(`lock file not found: ${lockPath}`);
  }
  const data = readFileSync(lockPath);
  return decrypt(data, masterKey);
}
