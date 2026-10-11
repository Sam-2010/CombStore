import { db } from './db';

// Constants for cryptographic standards
const PBKDF2_ITERATIONS = 100000;
const SALT_BYTE_LENGTH = 16;
const IV_BYTE_LENGTH = 12;
const CANARY_STRING = 'CLOUDMESH_VAULT_VERIFIED_V1';

// In-memory key caching during active session
let activeCryptoKey: CryptoKey | null = null;
let inMemoryDecryptedTokens: Record<string, any> | null = null;

// Helpers for ArrayBuffer <-> Base64 conversion
export function bufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

export function base64ToBuffer(base64: string): Uint8Array {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Derives an AES-GCM-256 CryptoKey from a Master Password using PBKDF2 (100k iterations, SHA-256)
 */
async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(password);

  const baseKey = await window.crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return await window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as any,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts an arbitrary string payload with AES-GCM using the given key.
 * Prepends the 12-byte IV to the ciphertext and returns Base64.
 */
async function encryptWithKey(key: CryptoKey, plainText: string): Promise<string> {
  const iv = window.crypto.getRandomValues(new Uint8Array(IV_BYTE_LENGTH));
  const encoder = new TextEncoder();
  const data = encoder.encode(plainText);

  const cipherBuffer = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  );

  const cipherBytes = new Uint8Array(cipherBuffer);
  // Combined format: [12-byte IV][Ciphertext]
  const combined = new Uint8Array(iv.length + cipherBytes.length);
  combined.set(iv, 0);
  combined.set(cipherBytes, iv.length);

  return bufferToBase64(combined);
}

/**
 * Decrypts a payload previously encrypted with encryptWithKey.
 */
async function decryptWithKey(key: CryptoKey, base64Payload: string): Promise<string> {
  const combined = base64ToBuffer(base64Payload);
  if (combined.length < IV_BYTE_LENGTH) {
    throw new Error('Ciphertext payload is too short or malformed');
  }

  const iv = combined.slice(0, IV_BYTE_LENGTH);
  const cipherBytes = combined.slice(IV_BYTE_LENGTH);

  const decryptedBuffer = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    cipherBytes
  );

  const decoder = new TextDecoder();
  return decoder.decode(decryptedBuffer);
}

/**
 * Checks if a master password has already been set up.
 */
export async function isVaultConfigured(): Promise<boolean> {
  const saltMeta = await db.meta.get('vault_salt');
  const canaryMeta = await db.meta.get('vault_canary');
  return !!(saltMeta && canaryMeta);
}

/**
 * Returns whether the vault is currently unlocked in memory.
 */
export function isVaultUnlocked(): boolean {
  return activeCryptoKey !== null;
}

/**
 * Sets up a new Master Password for the encrypted vault.
 */
export async function setupMasterPassword(password: string): Promise<boolean> {
  if (!password || password.length < 6) {
    throw new Error('Password must be at least 6 characters');
  }

  // Generate fresh 16-byte cryptographically secure salt
  const salt = window.crypto.getRandomValues(new Uint8Array(SALT_BYTE_LENGTH));
  const key = await deriveKey(password, salt);

  // Encrypt verification canary
  const canaryCipher = await encryptWithKey(key, CANARY_STRING);

  // Store salt and canary in db.meta
  await db.meta.put({ key: 'vault_salt', value: bufferToBase64(salt) });
  await db.meta.put({ key: 'vault_canary', value: canaryCipher });

  // Retain key in memory
  activeCryptoKey = key;
  inMemoryDecryptedTokens = {};

  // Initialize empty vault.enc if none exists
  const initialVaultEnc = await encryptWithKey(key, JSON.stringify({}));
  await db.meta.put({ key: 'vault_encrypted_tokens', value: initialVaultEnc });

  return true;
}

/**
 * Unlocks the vault by verifying the password against the stored canary.
 */
export async function unlockVault(password: string): Promise<boolean> {
  const saltMeta = await db.meta.get('vault_salt');
  const canaryMeta = await db.meta.get('vault_canary');

  if (!saltMeta || !canaryMeta) {
    throw new Error('Vault has not been set up yet. Please create a master password.');
  }

  const salt = base64ToBuffer(saltMeta.value);
  const key = await deriveKey(password, salt);

  try {
    const decryptedCanary = await decryptWithKey(key, canaryMeta.value);
    if (decryptedCanary !== CANARY_STRING) {
      throw new Error('Decryption canary mismatch');
    }

    activeCryptoKey = key;

    // Load and decrypt tokens if available
    const vaultTokensMeta = await db.meta.get('vault_encrypted_tokens');
    if (vaultTokensMeta && vaultTokensMeta.value) {
      try {
        const json = await decryptWithKey(key, vaultTokensMeta.value);
        inMemoryDecryptedTokens = JSON.parse(json);
      } catch (err) {
        console.warn('Failed to parse decrypted tokens:', err);
        inMemoryDecryptedTokens = {};
      }
    } else {
      inMemoryDecryptedTokens = {};
    }

    return true;
  } catch {
    activeCryptoKey = null;
    inMemoryDecryptedTokens = null;
    throw new Error('Incorrect Master Password. Please check and try again.');
  }
}

/**
 * Locks the vault, clearing keys and secrets from in-memory state.
 */
export function lockVault(): void {
  activeCryptoKey = null;
  inMemoryDecryptedTokens = null;
}

/**
 * Encrypts token map and returns base64 representation suitable for vault.enc
 */
export async function encryptTokenVaultPayload(tokenMap: Record<string, any>): Promise<string> {
  if (!activeCryptoKey) {
    throw new Error('Vault is locked. Unlock with Master Password first.');
  }
  const jsonStr = JSON.stringify(tokenMap);
  const encrypted = await encryptWithKey(activeCryptoKey, jsonStr);
  return encrypted;
}

/**
 * Decrypts raw vault.enc payload using active in-memory key
 */
export async function decryptTokenVaultPayload(encryptedBase64: string): Promise<Record<string, any>> {
  if (!activeCryptoKey) {
    throw new Error('Vault is locked. Unlock with Master Password first.');
  }
  const jsonStr = await decryptWithKey(activeCryptoKey, encryptedBase64);
  return JSON.parse(jsonStr);
}

/**
 * Stores secondary account tokens encrypted in DB and memory.
 */
export async function saveAccountToken(accountId: string, tokens: any): Promise<void> {
  if (!activeCryptoKey) {
    throw new Error('Vault is locked. Unlock with Master Password first.');
  }

  if (!inMemoryDecryptedTokens) {
    inMemoryDecryptedTokens = {};
  }

  inMemoryDecryptedTokens[accountId] = tokens;

  // Re-encrypt vault
  const encryptedPayload = await encryptTokenVaultPayload(inMemoryDecryptedTokens);
  await db.meta.put({ key: 'vault_encrypted_tokens', value: encryptedPayload });
}

/**
 * Retrieves tokens for an account from memory (if unlocked)
 */
export function getAccountToken(accountId: string): any | null {
  if (!activeCryptoKey || !inMemoryDecryptedTokens) {
    return null;
  }
  return inMemoryDecryptedTokens[accountId] || null;
}

/**
 * Retrieves raw vault.enc payload and salt for syncing to Google Drive appDataFolder
 */
export async function getVaultExportForSync(): Promise<{ vaultEnc: string; salt: string } | null> {
  const saltMeta = await db.meta.get('vault_salt');
  const tokensMeta = await db.meta.get('vault_encrypted_tokens');

  if (!saltMeta || !tokensMeta) return null;
  return {
    vaultEnc: tokensMeta.value,
    salt: saltMeta.value,
  };
}

/**
 * Imports vault from Google Drive appDataFolder sync
 */
export async function importVaultFromSync(vaultEnc: string, salt: string, canary?: string): Promise<void> {
  await db.meta.put({ key: 'vault_salt', value: salt });
  await db.meta.put({ key: 'vault_encrypted_tokens', value: vaultEnc });
  if (canary) {
    await db.meta.put({ key: 'vault_canary', value: canary });
  }
}
