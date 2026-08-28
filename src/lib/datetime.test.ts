import { describe, it, expect } from 'vitest';
import { zonedToUtc, utcToZonedInput } from './datetime';

const NZ = 'Pacific/Auckland';

describe('utcToZonedInput', () => {
	it('renders a UTC instant as NZ wall-clock for a datetime-local input', () => {
		// 2026-06-14T21:00Z is 2026-06-15 09:00 NZST (UTC+12)
		expect(utcToZonedInput('2026-06-14T21:00:00.000Z', NZ)).toBe('2026-06-15T09:00');
	});

	it('handles NZ daylight saving (UTC+13 in January)', () => {
		// 2026-01-14T20:00Z is 2026-01-15 09:00 NZDT (UTC+13)
		expect(utcToZonedInput('2026-01-14T20:00:00.000Z', NZ)).toBe('2026-01-15T09:00');
	});

	it('returns empty string for an invalid date', () => {
		expect(utcToZonedInput('not-a-date', NZ)).toBe('');
	});
});

describe('zonedToUtc <-> utcToZonedInput round-trip', () => {
	it('round-trips across both NZ DST offsets', () => {
		for (const iso of ['2026-06-14T21:00:00.000Z', '2026-01-14T20:00:00.000Z']) {
			const local = utcToZonedInput(iso, NZ); // "YYYY-MM-DDTHH:MM"
			expect(zonedToUtc(local + ':00', NZ)).toBe(iso);
		}
	});
});
