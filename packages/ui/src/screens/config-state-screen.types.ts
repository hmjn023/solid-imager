import type {
	McpToolInfo,
	AppConfig,
	AppConfigUpdate,
} from "@solid-imager/core/config";
import type { QueryUiState } from "../query-state";

export type ConfigStateScreenProps = {
	class?: string;
	data?: AppConfig;
	onRetry: () => void | Promise<void>;
	onSubmit: (value: AppConfigUpdate) => Promise<AppConfig>;
	loadMcpCatalog: () => Promise<McpToolInfo[]>;
	onSubmitSuccess?: () => void;
	state: QueryUiState<AppConfig>;
};
