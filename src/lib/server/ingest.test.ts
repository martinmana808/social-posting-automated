import { describe, it, expect } from 'vitest';
import { parseCsv, composeCaption, zonedToUtc } from './ingest';

describe('composeCaption', () => {
	it('joins title, blurb and hashtags with blank lines', () => {
		expect(composeCaption('New drop', 'Sterling silver', '#f925 #silver')).toBe(
			'New drop\n\nSterling silver\n\n#f925 #silver'
		);
	});

	it('adds missing # and accepts comma-separated tags', () => {
		expect(composeCaption('T', 'B', 'f925, silver handmade')).toBe('T\n\nB\n\n#f925 #silver #handmade');
	});

	it('skips empty parts', () => {
		expect(composeCaption('Only title', '', '')).toBe('Only title');
		expect(composeCaption('', 'just blurb', '')).toBe('just blurb');
	});
});

describe('parseCsv', () => {
	const TZ = 'Pacific/Auckland';
	const csv = `image,title,blurb,hashtags,date
https://x/1.jpg,Ring,Hand-finished,#f925 silver,2026-06-12 10:00
https://x/2.jpg,Cuff,Bold piece,bangle,2026-06-15`;

	it('parses rows and composes captions', () => {
		const rows = parseCsv(csv, TZ);
		expect(rows).toHaveLength(2);
		expect(rows[0].imageUrl).toBe('https://x/1.jpg');
		expect(rows[0].caption).toBe('Ring\n\nHand-finished\n\n#f925 #silver');
	});

	it('interprets times in the given timezone and stores UTC', () => {
		const rows = parseCsv(csv, TZ);
		// 2026-06-12 10:00 NZST (UTC+12 in June) -> 2026-06-11T22:00Z
		expect(rows[0].scheduledAt).toBe('2026-06-11T22:00:00.000Z');
		// missing time defaults to 09:00 NZST -> previous day 21:00Z
		expect(rows[1].scheduledAt).toBe('2026-06-14T21:00:00.000Z');
	});

	it('respects a different client timezone', () => {
		// 2026-06-15 09:00 in Buenos Aires (UTC-3) -> 12:00Z
		const rows = parseCsv('image,date\nhttps://x/1.jpg,2026-06-15', 'America/Argentina/Buenos_Aires');
		expect(rows[0].scheduledAt).toBe('2026-06-15T12:00:00.000Z');
	});

	it('zonedToUtc handles NZ daylight saving (UTC+13 in January)', () => {
		// 2026-01-15 09:00 NZDT (UTC+13) -> 2026-01-14T20:00Z
		expect(zonedToUtc('2026-01-15T09:00:00', 'Pacific/Auckland')).toBe('2026-01-14T20:00:00.000Z');
		// 2026-06-15 09:00 NZST (UTC+12) -> 2026-06-14T21:00Z
		expect(zonedToUtc('2026-06-15T09:00:00', 'Pacific/Auckland')).toBe('2026-06-14T21:00:00.000Z');
	});

	it('throws on a missing image or date', () => {
		expect(() => parseCsv('image,date\n,2026-06-12', TZ)).toThrow(/missing image/);
		expect(() => parseCsv('image,date\nhttps://x/1.jpg,', TZ)).toThrow(/missing date/);
	});

	it('throws on a malformed date', () => {
		expect(() => parseCsv('image,date\nhttps://x/1.jpg,12 June', TZ)).toThrow(/bad date/);
	});
});
