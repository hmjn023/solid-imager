import {
	createSourceService,
	FetchError,
} from "@solid-imager/application/services/source-service";
import type {
	MediaSource,
	NewMediaSource,
} from "@solid-imager/core/domain/repositories/source-repository";
import type { MediaSource as DbMediaSource } from "~/infrastructure/db/schema";
import { DrizzleSourceRepository } from "~/infrastructure/repositories/source-repository";

const HTTP_STATUS_INTERNAL_SERVER_ERROR = 500;

// Initialize repository
const sourceRepo = new DrizzleSourceRepository();
const sourceService = createSourceService({
	repository: sourceRepo,
	connectionTester: {
		async testConnection(source: MediaSource) {
			const { getDriver } = await import("~/infrastructure/storage/factory");
			const toDbMediaSource = (s: MediaSource): DbMediaSource =>
				({
					id: s.id,
					name: s.name,
					description: s.description || null,
					type: s.type,
					connectionInfo: s.connectionInfo,
					createdAt: s.createdAt,
					updatedAt: s.updatedAt,
				}) as DbMediaSource;
			const driver = getDriver(toDbMediaSource(source));
			return await driver.testConnection();
		},
	},
});

const fetchSourcesServer = async (): Promise<MediaSource[]> =>
	await sourceService.list();

const createSourceServer = async (
	sourceData: NewMediaSource,
): Promise<MediaSource[]> => {
	const result = await sourceRepo.create(sourceData);
	return [result];
};

const updateSourceServer = async (
	mediaSourceId: string,
	sourceData: Partial<MediaSource>,
): Promise<MediaSource[]> => {
	const result = await sourceRepo.update(mediaSourceId, sourceData);
	return [result];
};

const fetchSourceByIdServer = async (
	mediaSourceId: string,
): Promise<(MediaSource | undefined)[]> => {
	try {
		const result = await sourceService.get(mediaSourceId);
		return result ? [result] : [];
	} catch (_error) {
		return [];
	}
};

const deleteSourceServer = async (
	mediaSourceId: string,
): Promise<MediaSource[]> => {
	// The repository currently returns void for delete(), but the service expects MediaSource[].
	// We fetch it first before deleting to satisfy the return type if needed.
	const source = await sourceRepo.findById(mediaSourceId);
	await sourceRepo.delete(mediaSourceId);
	return source ? [source] : [];
};

const testConnectionServer = async (mediaSourceId: string) => {
	try {
		return await sourceService.testConnection(mediaSourceId);
	} catch (error: unknown) {
		if (error instanceof FetchError) {
			throw error;
		}
		const errorMessage = error instanceof Error ? error.message : String(error);
		throw new FetchError(
			`Failed to test media source connection: ${errorMessage}`,
			HTTP_STATUS_INTERNAL_SERVER_ERROR,
		);
	}
};

export const MediaSourceService = {
	fetchSources: fetchSourcesServer,
	createSource: createSourceServer,
	updateSource: updateSourceServer,
	fetchSourceById: fetchSourceByIdServer,
	deleteSource: deleteSourceServer,
	testConnection: testConnectionServer,
	getStatus: async (mediaSourceId: string) =>
		await sourceService.getStatus(mediaSourceId),
};
