import type { Transaction } from "../interfaces/transaction-manager";
import type { AddMediaRequest, Media } from "../media/schemas";
import type {
	MediaRegion,
	MediaRegionBoundingBox,
	MediaRegionRelationSnapshot,
} from "../media-regions/schemas";

export type NewMediaRegion = {
	mediaId: string;
	kind: "person" | "manual";
	bbox: MediaRegionBoundingBox;
	sourceWidth: number;
	sourceHeight: number;
	sourceModifiedAt: Date;
	sourceRevision: string;
	regionRevision: string;
	label: string | null;
	manualReason: string | null;
	detectionKey: string | null;
	detector: string | null;
	detectorModel: string | null;
	detectorVersion: string | null;
	score: number | null;
};

export type MediaRegionUpdate = {
	bbox?: MediaRegionBoundingBox;
	kind?: "person" | "manual";
	regionRevision: string;
	label?: string | null;
	manualReason?: string | null;
	detectionKey?: string | null;
	updatedAt: Date;
};

export type CreateMaterializedMedia = {
	media: AddMediaRequest;
	parentMediaId: string;
	sourceRegionId: string;
	derivationKey: string;
	snapshot: MediaRegionRelationSnapshot;
};

export interface IMediaRegionRepository {
	findByMediaId(mediaId: string, tx?: Transaction): Promise<MediaRegion[]>;
	findById(id: string, tx?: Transaction): Promise<MediaRegion | null>;
	create(data: NewMediaRegion, tx?: Transaction): Promise<MediaRegion>;
	upsertDetected(data: NewMediaRegion, tx?: Transaction): Promise<MediaRegion>;
	deleteDetectedNotIn(
		mediaId: string,
		detectionKeys: string[],
		tx?: Transaction,
	): Promise<void>;
	update(
		id: string,
		expectedRevision: string,
		data: MediaRegionUpdate,
		tx?: Transaction,
	): Promise<MediaRegion | null>;
	delete(
		id: string,
		expectedRevision: string,
		tx?: Transaction,
	): Promise<boolean>;
	findMaterializedByDerivationKey(
		derivationKey: string,
		tx?: Transaction,
	): Promise<Media | null>;
	createMaterialized(
		data: CreateMaterializedMedia,
		tx?: Transaction,
	): Promise<Media>;
}
