import { describe, expect, it } from 'vite-plus/test';
import { prepareJob, retryDelayMs, validateJobPayload } from './registry';
import { JOB_TYPES } from './schemas';

const MEDIA_ID = '11111111-1111-4111-8111-111111111111';
const SOURCE_ID = '22222222-2222-4222-8222-222222222222';
const PARENT_ID = '33333333-3333-4333-8333-333333333333';

describe('job registry', () => {
	it('defines a runtime payload schema for every durable job type', () => {
		const payloads: Record<(typeof JOB_TYPES)[number], unknown> = {
			processMedia: { mediaId: MEDIA_ID, sourcePath: '/media' },
			downloadImage: { targetUrl: 'https://example.com/image.png' },
			auto_tagging: { mediaId: MEDIA_ID },
			extract_ccip_vector: { mediaId: MEDIA_ID },
			bulk_tagging_parent: { total: 0, processed: 0, failed: 0 },
			bulk_tagging_dispatch: { mediaSourceId: SOURCE_ID },
			batch_ccip_parent: { total: 0, processed: 0, failed: 0 },
			batch_ccip_dispatch: { mediaSourceId: SOURCE_ID },
			import_request: { targetUrl: 'https://example.com/image.png' },
			sync_lancedb: null,
			sync_lancedb_full: { reason: 'test' },
			sync_lancedb_delta: { mediaIds: [MEDIA_ID] },
		};

		for (const type of JOB_TYPES) {
			expect(validateJobPayload(type, payloads[type]).success).toBe(true);
		}
	});

	it('assigns deterministic queue, retry, dedupe and concurrency policy', () => {
		const prepared = prepareJob({
			type: 'auto_tagging',
			mediaSourceId: SOURCE_ID,
			targetId: MEDIA_ID,
			inputRevision: 'revision-1',
			payload: { mediaId: MEDIA_ID, force: true },
		});

		expect(prepared.queueName).toBe('ai');
		expect(prepared.maxAttempts).toBe(5);
		expect(prepared.leaseDurationMs).toBe(300_000);
		expect(prepared.dedupeKey).toBe(
			`auto_tagging:${MEDIA_ID}:revision-1:force`,
		);
		expect(prepared.concurrencyKey).toBe(`media:${MEDIA_ID}:auto_tagging`);
	});

	it('scopes batch child dedupe to its parent', () => {
		const prepared = prepareJob({
			type: 'extract_ccip_vector',
			mediaSourceId: SOURCE_ID,
			parentId: PARENT_ID,
			targetId: MEDIA_ID,
			inputRevision: 'revision-2',
			payload: { mediaId: MEDIA_ID },
		});

		expect(prepared.dedupeKey).toBe(
			`extract_ccip_vector:${PARENT_ID}:${MEDIA_ID}:revision-2:normal`,
		);
	});

	it('keeps full and metadata-skip processing requests distinct but serialized', () => {
		const full = prepareJob({
			type: 'processMedia',
			mediaSourceId: SOURCE_ID,
			targetId: MEDIA_ID,
			inputRevision: 'revision-3',
			payload: { mediaId: MEDIA_ID, sourcePath: '/media' },
		});
		const skip = prepareJob({
			type: 'processMedia',
			mediaSourceId: SOURCE_ID,
			targetId: MEDIA_ID,
			inputRevision: 'revision-3',
			payload: {
				mediaId: MEDIA_ID,
				sourcePath: '/media',
				skipMetadataExtraction: true,
			},
		});

		expect(full.dedupeKey).toContain('metadata-full');
		expect(skip.dedupeKey).toContain('metadata-skip');
		expect(full.dedupeKey).not.toBe(skip.dedupeKey);
		expect(full.concurrencyKey).toBe(skip.concurrencyKey);
	});

	it('keeps force requests distinct while serializing each AI target', () => {
		for (const type of ['auto_tagging', 'extract_ccip_vector'] as const) {
			const normal = prepareJob({
				type,
				mediaSourceId: SOURCE_ID,
				targetId: MEDIA_ID,
				inputRevision: 'revision-4',
				payload: { mediaId: MEDIA_ID, force: false },
			});
			const force = prepareJob({
				type,
				mediaSourceId: SOURCE_ID,
				targetId: MEDIA_ID,
				inputRevision: 'revision-4',
				payload: { mediaId: MEDIA_ID, force: true },
			});
			expect(normal.dedupeKey).not.toBe(force.dedupeKey);
			expect(normal.concurrencyKey).toBe(force.concurrencyKey);
		}
	});

	it('scopes download dedupe to its destination and leaves import inbox items unique', () => {
		const url = 'https://example.com/image.png';
		const first = prepareJob({
			type: 'downloadImage',
			mediaSourceId: SOURCE_ID,
			payload: { targetUrl: url, fileName: 'first.png' },
		});
		const second = prepareJob({
			type: 'downloadImage',
			mediaSourceId: '44444444-4444-4444-8444-444444444444',
			payload: { targetUrl: url, fileName: 'first.png' },
		});
		const renamed = prepareJob({
			type: 'downloadImage',
			mediaSourceId: SOURCE_ID,
			payload: { targetUrl: url, fileName: 'second.png' },
		});
		const importRequest = prepareJob({
			type: 'import_request',
			payload: { targetUrl: url },
		});

		expect(first.dedupeKey).not.toBe(second.dedupeKey);
		expect(first.dedupeKey).not.toBe(renamed.dedupeKey);
		expect(importRequest.dedupeKey).toBeNull();
	});

	it('uses bounded exponential retry delay with deterministic jitter', () => {
		expect(retryDelayMs(1, 0.5)).toBe(5_000);
		expect(retryDelayMs(2, 0.5)).toBe(10_000);
		expect(retryDelayMs(99, 0.5)).toBe(900_000);
	});

	it('rejects unknown types at creation and invalid payloads at execution', () => {
		expect(() => prepareJob({ type: 'unknown' })).toThrow('Unknown job type');
		expect(validateJobPayload('auto_tagging', { mediaId: 'not-a-uuid' }).success).toBe(
			false,
		);
		expect(validateJobPayload('unknown', {}).success).toBe(false);
	});
});
