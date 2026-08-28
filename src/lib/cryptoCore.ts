// Pure AES-256-GCM helpers. The key is passed in explicitly (as 64-char hex) so
// this module has NO dependency on SvelteKit's $env — the Netlify background
// function can call it with process.env.TOKEN_ENCRYPTION_KEY, and the server
// wrapper (crypto.ts) can call it with the config value.
//
// Stored format:  <iv-hex>:<authTag-hex>:<ciphertext-hex>
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';

function keyBuffer(keyHex: string): Buffer {
	const buf = Buffer.from(keyHex, 'hex');
	if (buf.length !== 32) {
		throw new Error(
			'TOKEN_ENCRYPTION_KEY must be 32 bytes hex (64 chars). Generate: openssl rand -hex 32'
		);
	}
	return buf;
}

export function encrypt(plaintext: string, keyHex: string): string {
	const iv = randomBytes(12);
	const cipher = createCipheriv(ALGORITHM, keyBuffer(keyHex), iv);
	const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
	const authTag = cipher.getAuthTag();
	return [iv.toString('hex'), authTag.toString('hex'), ciphertext.toString('hex')].join(':');
}

export function decrypt(stored: string, keyHex: string): string {
	const [ivHex, tagHex, dataHex] = stored.split(':');
	if (!ivHex || !tagHex || !dataHex) {
		throw new Error('Malformed encrypted token.');
	}
	const decipher = createDecipheriv(ALGORITHM, keyBuffer(keyHex), Buffer.from(ivHex, 'hex'));
	decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
	return Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]).toString(
		'utf8'
	);
}
