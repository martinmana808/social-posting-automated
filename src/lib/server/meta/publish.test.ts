import { describe, it, expect, vi } from 'vitest';
import { publishPhoto, publishMultiPhoto, publishFacebook } from './facebook';
import { publishImage, publishCarousel } from './instagram';
import { GraphError } from './client';

const ok = (body: unknown) =>
	new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });

describe('facebook', () => {
	it('publishPhoto posts a single image + caption', async () => {
		const fetchMock = vi.fn(async (url: any, init: any) => {
			expect(String(url)).toContain('PAGE/photos');
			expect(String(init.body)).toContain('published=true');
			return ok({ id: 'photo1', post_id: 'PAGE_post1' });
		});
		expect(await publishPhoto('PAGE', 'tok', 'https://i/1.jpg', 'hi', fetchMock as any)).toBe('PAGE_post1');
	});

	it('publishMultiPhoto uploads unpublished then posts to feed', async () => {
		const calls: string[] = [];
		const fetchMock = vi.fn(async (url: any, init: any) => {
			calls.push(String(url));
			if (String(url).includes('/photos')) {
				expect(String(init.body)).toContain('published=false');
				return ok({ id: `m${calls.length}` });
			}
			expect(String(init.body)).toContain('attached_media');
			return ok({ id: 'FEED' });
		});
		const id = await publishMultiPhoto('PAGE', 'tok', ['https://i/1.jpg', 'https://i/2.jpg'], 'cap', fetchMock as any);
		expect(id).toBe('FEED');
		expect(calls.filter((c) => c.includes('/photos'))).toHaveLength(2);
	});

	it('publishFacebook routes by image count', async () => {
		const single = vi.fn(async () => ok({ id: 'x', post_id: 'SINGLE' }));
		expect(await publishFacebook('P', 't', ['https://i/1.jpg'], 'c', single as any)).toBe('SINGLE');
	});
});

describe('instagram', () => {
	it('publishImage does container then publish', async () => {
		const seq: string[] = [];
		const fetchMock = vi.fn(async (url: any) => {
			if (String(url).endsWith('/media')) { seq.push('create'); return ok({ id: 'C1' }); }
			seq.push('publish');
			return ok({ id: 'IG1' });
		});
		expect(await publishImage('IGU', 'tok', 'https://i/1.jpg', 'hi', fetchMock as any)).toBe('IG1');
		expect(seq).toEqual(['create', 'publish']);
	});

	it('publishCarousel builds children + parent then publishes', async () => {
		let n = 0;
		const fetchMock = vi.fn(async (url: any, init: any) => {
			const u = String(url), b = String(init.body);
			if (u.endsWith('/media') && b.includes('is_carousel_item=true')) return ok({ id: `CH${++n}` });
			if (u.endsWith('/media') && b.includes('media_type=CAROUSEL')) {
				expect(b).toContain('children=CH1%2CCH2');
				return ok({ id: 'PARENT' });
			}
			expect(b).toContain('creation_id=PARENT');
			return ok({ id: 'IGCAR' });
		});
		const noWait = vi.fn(async () => {});
		const id = await publishCarousel('IGU', 'tok', ['https://i/1.jpg', 'https://i/2.jpg'], 'cap', fetchMock as any, noWait as any);
		expect(id).toBe('IGCAR');
		expect(noWait).toHaveBeenCalledTimes(3);
	});

	it('rejects carousels outside 2–10 images', async () => {
		await expect(publishCarousel('IGU', 'tok', ['one.jpg'], 'x', (async () => ok({})) as any)).rejects.toBeInstanceOf(GraphError);
	});
});
