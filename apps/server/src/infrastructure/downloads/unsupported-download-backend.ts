import type {
	DownloadBackendCapabilities,
	IDownloadBackend,
} from "@solid-imager/core/domain/services/download-backend";
import { UnsupportedRuntimeError } from "~/infrastructure/app-client/errors";

const unsupportedCapabilities: DownloadBackendCapabilities = {
	kind: "unsupported",
	supportsMetadata: false,
	supportsDownload: false,
};

export class UnsupportedDownloadBackend implements IDownloadBackend {
	constructor(private readonly message: string) {}

	getCapabilities(): DownloadBackendCapabilities {
		return unsupportedCapabilities;
	}

	async fetchMetadata(): Promise<null> {
		return null;
	}

	async download(): Promise<never> {
		throw new UnsupportedRuntimeError(this.message);
	}
}
