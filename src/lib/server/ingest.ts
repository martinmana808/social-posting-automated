// Parse a client's CSV and turn it into posts.
//
// CSV columns (case-insensitive headers): image, title, blurb, hashtags, date
//   image    = public HTTPS image URL (pipe-separate for a carousel)
//   date     = "YYYY-MM-DD" or "YYYY-MM-DD HH:MM" (defaults to 09:00, in the
//              client's timezone)
// The published caption is composed from title + blurb + hashtags.
import { parse } from 'csv-parse/sync';
import { supabase } from './supabase';
import { zonedToUtc } from '$lib/datetime';

// Re-exported for backwards compatibility (tests import it from here).
export { zonedToUtc };

export interface ParsedPost {
	scheduledAt: string;
	imageUrl: string;
	title: string;
	blurb: string;
	hashtags: string;
	caption: string;
}

/** Compose the final caption. Pure + exported for testing. */
export function composeCaption(title: string, blurb: string, hashtags: string): string {
	return [title.trim(), blurb.trim(), normaliseHashtags(hashtags)]
		.filter((part) => part.length > 0)
		.join('\n\n');
}

/** Ensure each tag starts with #, accept comma/space separated input. */
function normaliseHashtags(raw: string): string {
	if (!raw?.trim()) return '';
	return raw
		.split(/[\s,]+/)
		.map((t) => t.trim())
		.filter(Boolean)
		.map((t) => (t.startsWith('#') ? t : `#${t}`))
		.join(' ');
}

export function parseCsv(csvText: string, timeZone: string): ParsedPost[] {
	const records: Record<string, string>[] = parse(csvText, {
		columns: (header: string[]) => header.map((h) => h.trim().toLowerCase()),
		skip_empty_lines: true,
		trim: true
	});

	return records.map((r, i) => {
		const imageUrl = r.image ?? r.image_url ?? r.src ?? '';
		if (!imageUrl) throw new Error(`Row ${i + 1}: missing image URL`);
		if (!r.date) throw new Error(`Row ${i + 1}: missing date`);

		const scheduledAt = parseDate(r.date, i, timeZone);
		const title = r.title ?? '';
		const blurb = r.blurb ?? '';
		const hashtags = r.hashtags ?? '';

		return {
			scheduledAt,
			imageUrl,
			title,
			blurb,
			hashtags,
			caption: composeCaption(title, blurb, hashtags)
		};
	});
}

function parseDate(raw: string, i: number, timeZone: string): string {
	const value = raw.trim();
	// "YYYY-MM-DD" or "YYYY-MM-DD HH:MM"
	const m = value.match(/^(\d{4}-\d{2}-\d{2})(?:[ T](\d{1,2}:\d{2}))?$/);
	if (!m) throw new Error(`Row ${i + 1}: bad date "${raw}" (use YYYY-MM-DD or YYYY-MM-DD HH:MM)`);
	const [hh, mm] = (m[2] ?? '09:00').split(':');
	const naive = `${m[1]}T${hh.padStart(2, '0')}:${mm}:00`;
	const iso = zonedToUtc(naive, timeZone);
	if (!iso) throw new Error(`Row ${i + 1}: invalid date "${raw}"`);
	return iso;
}

/** Insert parsed posts for one client as pending. Returns the number inserted. */
export async function savePosts(clientId: string, posts: ParsedPost[]): Promise<number> {
	if (!posts.length) return 0;
	const rows = posts.map((p) => ({
		client_id: clientId,
		scheduled_at: p.scheduledAt,
		image_url: p.imageUrl,
		title: p.title,
		blurb: p.blurb,
		hashtags: p.hashtags,
		caption: p.caption,
		status: 'pending'
	}));
	const { data, error } = await supabase().from('posts').insert(rows).select('id');
	if (error) throw error;
	return data?.length ?? 0;
}
