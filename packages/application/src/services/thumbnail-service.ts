import type { IFileSystem } from "@solid-imager/core/interfaces/file-system";
import type { IThumbnailService } from "../ports/thumbnail-service";

export type ThumbnailServiceDeps = {
	fileSystem: IFileSystem;
	thumbnailCacheDir: string;
	generateThumbnailsForSource: (mediaSourceId: string) => Promise<number>;
};

export class ThumbnailServiceImpl implements IThumbnailService {
	private readonly fileSystem: IFileSystem;
	private readonly thumbnailCacheDir: string;
	private readonly generateThumbnailsForSource: ThumbnailServiceDeps["generateThumbnailsForSource"];

	constructor(deps: ThumbnailServiceDeps) {
		this.fileSystem = deps.fileSystem;
		this.thumbnailCacheDir = deps.thumbnailCacheDir;
		this.generateThumbnailsForSource = deps.generateThumbnailsForSource;
	}

	getMediaThumbnailUrl(
		mediaSourceId: string,
		mediaId: string,
		size?: number,
	): string {
		let url = `/api/sources/${mediaSourceId}/${mediaId}/thumbnail`;
		if (size) {
			url += `?size=${size}`;
		}
		return url;
	}

	async startThumbnailGeneration(
		mediaSourceId: string,
	): Promise<{ success: boolean; count: number }> {
		const count = await this.generateThumbnailsForSource(mediaSourceId);
		return { success: true, count };
	}

	async clearThumbnailCache(
		mediaSourceId: string,
	): Promise<{ success: boolean }> {
		const cacheDir = `${this.thumbnailCacheDir}/${mediaSourceId}`;
		try {
			await this.fileSystem.rm(cacheDir, { recursive: true, force: true });
			return { success: true };
		} catch (error) {
			throw new Error(`Failed to clear thumbnail cache: ${error}`);
		}
	}
}
