import type {
	MediaSource,
	SourceRepository,
} from "@solid-imager/core/domain/repositories/source-repository";
import type { SafeMediaSource } from "@solid-imager/core/domain/sources/schemas";

export type SourceConnectionTest = {
	success: boolean;
	message?: string;
};

export type SourceConnectionTester = {
	testConnection(source: MediaSource): Promise<SourceConnectionTest>;
};

export class FetchError {
	readonly _tag = "FetchError";
	readonly message: string;
	readonly status?: number;

	constructor(message: string, status?: number) {
		this.message = message;
		this.status = status;
	}
}

const HTTP_STATUS_NOT_FOUND = 404;
const HTTP_STATUS_INTERNAL_SERVER_ERROR = 500;

export function toSafeMediaSource(source: MediaSource): SafeMediaSource {
	if (source.type === "sftp") {
		const info = source.connectionInfo as {
			host: string;
			port: number;
			username: string;
			remotePath: string;
		};
		return {
			...source,
			connectionInfo: {
				host: info.host,
				port: info.port,
				username: info.username,
				remotePath: info.remotePath,
			},
		};
	}

	if (source.type === "s3") {
		const info = source.connectionInfo as {
			bucket: string;
			region: string;
			prefix?: string;
		};
		return {
			...source,
			connectionInfo: {
				bucket: info.bucket,
				region: info.region,
				prefix: info.prefix,
			},
		};
	}

	return source as SafeMediaSource;
}

export type SourceServiceDeps = {
	repository: SourceRepository;
	connectionTester?: SourceConnectionTester;
};

export function createSourceService({
	repository,
	connectionTester,
}: SourceServiceDeps) {
	return {
		async list(): Promise<MediaSource[]> {
			return await repository.findAll();
		},

		async listSafe(): Promise<SafeMediaSource[]> {
			const sources = await repository.findAll();
			return sources.map(toSafeMediaSource);
		},

		async get(id: string): Promise<MediaSource | null> {
			return await repository.findById(id);
		},

		async getSafe(id: string): Promise<SafeMediaSource | null> {
			const source = await repository.findById(id);
			return source ? toSafeMediaSource(source) : null;
		},

		async testConnection(id: string): Promise<SourceConnectionTest> {
			if (!connectionTester) {
				throw new FetchError(
					"Connection testing is not configured",
					HTTP_STATUS_INTERNAL_SERVER_ERROR,
				);
			}

			const source = await repository.findById(id);
			if (!source) {
				throw new FetchError(
					"指定されたメディアソースが見つかりません",
					HTTP_STATUS_NOT_FOUND,
				);
			}
			const test = await connectionTester.testConnection(source);
			if (!test.success) {
				throw new FetchError(
					`接続に失敗しました: ${test.message ?? "不明なエラー"}`,
					HTTP_STATUS_INTERNAL_SERVER_ERROR,
				);
			}
			return test;
		},

		async getStatus(id: string) {
			try {
				const test = await this.testConnection(id);
				return {
					mediaSourceId: id,
					status: test.success ? "active" : "error",
					message: test.message,
					lastChecked: new Date(),
				};
			} catch (error: unknown) {
				const errorMessage =
					error instanceof Error ? error.message : String(error);
				return {
					mediaSourceId: id,
					status: "error",
					message: errorMessage,
					lastChecked: new Date(),
				};
			}
		},
	};
}
