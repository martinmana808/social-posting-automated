// Server-side token encryption. Thin wrapper over the pure cryptoCore, supplying
// the key from validated config. Client Page tokens are encrypted at rest and
// decrypted only in memory, just before a Graph API call.
import { encrypt, decrypt } from '../cryptoCore';
import { config } from './config';

export const encryptToken = (plaintext: string): string =>
	encrypt(plaintext, config.security.tokenEncryptionKey());

export const decryptToken = (stored: string): string =>
	decrypt(stored, config.security.tokenEncryptionKey());
