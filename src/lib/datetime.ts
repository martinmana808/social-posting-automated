// Timezone helpers shared by the server (ingest, edit actions) and the browser
// (prefilling the date/time picker). Pure: only Intl + Date, no Node APIs, so it
// is safe to import from Svelte components.

/**
 * Convert a wall-clock datetime ("YYYY-MM-DDTHH:MM:SS") that is meant to be read
 * in `timeZone` into a UTC ISO string. Uses Intl to find the zone's offset at
 * that instant, so DST is handled correctly — no timezone library needed.
 */
export function zonedToUtc(naive: string, timeZone: string): string | null {
	const asUtc = new Date(naive + 'Z');
	if (isNaN(asUtc.getTime())) return null;
	const dtf = new Intl.DateTimeFormat('en-US', {
		timeZone,
		hourCycle: 'h23',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit'
	});
	const p = dtf.formatToParts(asUtc).reduce<Record<string, string>>((acc, part) => {
		if (part.type !== 'literal') acc[part.type] = part.value;
		return acc;
	}, {});
	const localAsUtc = Date.UTC(
		Number(p.year),
		Number(p.month) - 1,
		Number(p.day),
		Number(p.hour),
		Number(p.minute),
		Number(p.second)
	);
	const offset = localAsUtc - asUtc.getTime();
	return new Date(asUtc.getTime() - offset).toISOString();
}

/**
 * Format a UTC ISO instant as a `datetime-local` input value ("YYYY-MM-DDTHH:MM")
 * showing the wall-clock time in `timeZone`. The inverse of `zonedToUtc` (to the
 * minute), used to prefill the schedule picker in NZ time.
 */
export function utcToZonedInput(iso: string, timeZone: string): string {
	const date = new Date(iso);
	if (isNaN(date.getTime())) return '';
	const dtf = new Intl.DateTimeFormat('en-CA', {
		timeZone,
		hourCycle: 'h23',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit'
	});
	const p = dtf.formatToParts(date).reduce<Record<string, string>>((acc, part) => {
		if (part.type !== 'literal') acc[part.type] = part.value;
		return acc;
	}, {});
	return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}
