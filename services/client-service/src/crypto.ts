import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'node:crypto';
import { config } from './config.js';

function getKey(): Buffer {
  const raw = config.credentialsEncryptionKey;
  if (Buffer.byteLength(raw) === 32) {
    return Buffer.from(raw);
  }
  return createHash('sha256').update(raw).digest();
}

export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`;
}

export function decrypt(encoded: string): string {
  const key = getKey();
  const [ivB64, authTagB64, ciphertextB64] = encoded.split(':');
  const iv = Buffer.from(ivB64, 'base64');
  const authTag = Buffer.from(authTagB64, 'base64');
  const ciphertext = Buffer.from(ciphertextB64, 'base64');
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  return decipher.update(ciphertext).toString('utf8') + decipher.final('utf8');
}

export function encryptArray(arr: string[]): string[] {
  return arr.map(encrypt);
}

export function decryptArray(arr: string[]): string[] {
  return arr.map(decrypt);
}
