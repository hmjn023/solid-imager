import path from 'node:path';
import { createJobRepository } from '@solid-imager/db/repositories/job-repository';
import { jobs, lanceDbSyncDirty, mediaSources } from '@solid-imager/db/schema';
import { and, desc, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { afterEach, beforeEach, describe, expect, it } from 'vite-plus/test';
import { createPglite } from '~/infrastructure/db/pglite';
import { ccipJobTargetsMedia } from '~/infrastructure/jobs/ccip-job-query';
import * as schema from '~/infrastructure/db/schema';

const SOURCE_ID = '10000000-0000-4000-8000-000000000001';
const MEDIA_A = '20000000-0000-4000-8000-000000000001';
const MEDIA_B = '20000000-0000-4000-8000-000000000002';
const MEDIA_C = '20000000-0000-4000-8000-000000000003';

describe('JobRepository durable claims', () => {
	let client: ReturnType<typeof createPglite> | undefined;
	let database: ReturnType<typeof drizzle<typeof schema>>;

	beforeEach(async () => {
		client = createPglite();
		database = drizzle(client, { schema });
		const migrationsFolder = process.cwd().endsWith('apps/server')
			? path.resolve(process.cwd(), 'drizzle')
			: path.resolve(process.cwd(), 'apps/server/drizzle');
		await migrate(database, { migrationsFolder });
		await database.insert(mediaSources).values({
			id: SOURCE_ID,
			name: 'Job source',
			description: null,
			type: 'local',
			connectionInfo: { path: '/tmp/job-source' },
		});
	});

	afterEach(async () => {
		await client?.close();
		client = undefined;
	});

	it('stores delta changes in the dirty table and creates a follow-up for running work', async () => {
		const repository = createJobRepository(() => database);
		await repository.createIfUnique({
			type: 'sync_lancedb_delta',
			mediaSourceId: SOURCE_ID,
			payload: { mediaIds: [MEDIA_A] },
		});
		await Promise.all([
			repository.createIfUnique({
				type: 'sync_lancedb_delta',
				mediaSourceId: SOURCE_ID,
				payload: { mediaIds: [MEDIA_B] },
			}),
			repository.createIfUnique({
				type: 'sync_lancedb_delta',
				mediaSourceId: SOURCE_ID,
				payload: { mediaIds: [MEDIA_C] },
			}),
		]);

		const [pending] = await database
			.select()
			.from(jobs)
			.where(eq(jobs.status, 'pending'));
		expect(pending.payload).toEqual({ reason: 'dirty' });
		const dirtyRows = await database.select().from(lanceDbSyncDirty);
		expect(dirtyRows).toEqual(
			expect.arrayContaining(
				[MEDIA_A, MEDIA_B, MEDIA_C].map((mediaId) =>
					expect.objectContaining({ mediaId, operation: 'upsert' }),
				),
			),
		);

		const [claimed] = await repository.claimPending(1, {
			includeTypes: ['sync_lancedb_delta'],
			queueNames: ['default'],
			workerId: 'integration-worker',
		});
		expect(claimed.claimToken).toBeTruthy();
		await repository.createIfUnique({
			type: 'sync_lancedb_delta',
			mediaSourceId: SOURCE_ID,
			payload: { mediaIds: [MEDIA_A] },
		});
		const activeRows = await database
			.select()
			.from(jobs)
			.where(eq(jobs.type, 'sync_lancedb_delta'));
		expect(activeRows.map((row) => row.status).sort()).toEqual([
			'in_progress',
			'pending',
		]);
		expect(activeRows.some((row) => row.dedupeKey?.endsWith(':followup'))).toBe(
			true,
		);
	});

	it('preserves mixed upsert and delete operations per dirty media row', async () => {
		const repository = createJobRepository(() => database);
		await repository.createIfUnique({
			type: 'sync_lancedb_delta',
			mediaSourceId: SOURCE_ID,
			payload: { mediaIds: [MEDIA_A], operation: 'upsert' },
		});
		await repository.createIfUnique({
			type: 'sync_lancedb_delta',
			mediaSourceId: SOURCE_ID,
			payload: { mediaIds: [MEDIA_B], operation: 'delete' },
		});

		let dirtyRows = await database
			.select()
			.from(lanceDbSyncDirty)
			.where(eq(lanceDbSyncDirty.mediaSourceId, SOURCE_ID));
		expect(
			dirtyRows.map(({ mediaId, operation }) => ({ mediaId, operation })),
		).toEqual(
			expect.arrayContaining([
				{ mediaId: MEDIA_A, operation: 'upsert' },
				{ mediaId: MEDIA_B, operation: 'delete' },
			]),
		);

		await repository.createIfUnique({
			type: 'sync_lancedb_delta',
			mediaSourceId: SOURCE_ID,
			payload: { mediaId: MEDIA_A, operation: 'delete' },
		});
		dirtyRows = await database
			.select()
			.from(lanceDbSyncDirty)
			.where(eq(lanceDbSyncDirty.mediaId, MEDIA_A));
		expect(dirtyRows[0]).toEqual(
			expect.objectContaining({
				mediaId: MEDIA_A,
				operation: 'delete',
				generation: 1,
			}),
		);
	});

	it('finds legacy CCIP batch jobs by a mediaIds payload member', async () => {
		const repository = createJobRepository(() => database);
		const legacyJob = await repository.create({
			type: 'extract_ccip_vector',
			mediaSourceId: SOURCE_ID,
			payload: { mediaIds: [MEDIA_A, MEDIA_B], force: false },
		});
		await database
			.update(jobs)
			.set({ status: 'failed', errorCode: 'JOB_EXECUTION_FAILED' })
			.where(eq(jobs.id, legacyJob.id));

		const [latestJob] = await database
			.select()
			.from(jobs)
			.where(
				and(
					eq(jobs.type, 'extract_ccip_vector'),
					eq(jobs.mediaSourceId, SOURCE_ID),
					ccipJobTargetsMedia(MEDIA_B),
				),
			)
			.orderBy(desc(jobs.createdAt))
			.limit(1);

		expect(latestJob).toEqual(
			expect.objectContaining({
				id: legacyJob.id,
				status: 'failed',
				errorCode: 'JOB_EXECUTION_FAILED',
			}),
		);
	});

	it('fences completion by token and input revision', async () => {
		const repository = createJobRepository(() => database);
		await repository.create({
			type: 'processMedia',
			mediaSourceId: SOURCE_ID,
			targetId: MEDIA_A,
			inputRevision: 'revision-a',
			payload: { mediaId: MEDIA_A, sourcePath: '/tmp/job-source' },
		});
		const [claimed] = await repository.claimPending(1, {
			includeTypes: ['processMedia'],
			workerId: 'integration-worker',
		});
		expect(claimed.claimToken).toBeTruthy();
		const wrongFence = await repository.completeClaim(claimed.id, {
			claimToken: '30000000-0000-4000-8000-000000000001',
			inputRevision: claimed.inputRevision,
		});
		expect(wrongFence).toBe(false);
		const accepted = await repository.completeClaim(
			claimed.id,
			{
				claimToken: claimed.claimToken ?? '',
				inputRevision: claimed.inputRevision,
			},
			{ success: true },
		);
		expect(accepted).toBe(true);
		expect((await repository.findById(claimed.id))?.status).toBe('completed');
	});

	it('claims at most one pending row for each concurrency key', async () => {
		const repository = createJobRepository(() => database);
		for (const [mediaId, revision] of [
			[MEDIA_A, 'revision-a'],
			[MEDIA_B, 'revision-b'],
		] as const) {
			await repository.create({
				type: 'processMedia',
				mediaSourceId: SOURCE_ID,
				targetId: mediaId,
				inputRevision: revision,
				concurrencyKey: 'shared-test-key',
				payload: { mediaId, sourcePath: '/tmp/job-source' },
			});
		}
		const claimed = await repository.claimPending(2, {
			includeTypes: ['processMedia'],
			workerId: 'integration-worker',
		});
		expect(claimed).toHaveLength(1);
	});

	it('rolls back the parent when dispatch creation fails', async () => {
		const repository = createJobRepository(() => database);
		await expect(
			repository.createParentWithDispatch(
				{
					type: 'bulk_tagging_parent',
					status: 'in_progress',
					payload: { total: 0, processed: 0, failed: 0 },
				},
				{ type: 'unknown_dispatch', payload: {} },
			),
		).rejects.toThrow('Unknown job type');
		const parentRows = await database
			.select()
			.from(jobs)
			.where(eq(jobs.type, 'bulk_tagging_parent'));
		expect(parentRows).toHaveLength(0);
	});
});
