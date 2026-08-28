import { describe, it, expect } from 'vitest';
import { encrypt, decrypt } from './cryptoCore';

const KEY = 'a'.repeat(64); // 32 bytes hex

describe('cryptoCore', () => {
	it('round-trips a token', () => {
		const token = 'EAABs-a-very-long-page-access-token';
		expect(decrypt(encrypt(token, KEY), KEY)).toBe(token);
	});

	it('produces different ciphertext each time (random IV)', () => {
		expect(encrypt('same', KEY)).not.toBe(encrypt('same', KEY));
	});

	it('rejects a key that is not 32 bytes hex', () => {
		expect(() => encrypt('x', 'abcd')).toThrow(/32 bytes hex/);
	});

	it('rejects a malformed ciphertext', () => {
		expect(() => decrypt('not-valid', KEY)).toThrow(/Malformed/);
	});

	it('fails to decrypt with the wrong key', () => {
		const enc = encrypt('secret', KEY);
		expect(() => decrypt(enc, 'b'.repeat(64))).toThrow();
	});
});
