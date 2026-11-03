import type { McpToolInfo } from "@solid-imager/core/domain/config/mcp";
import type {
	AppConfig,
	AppConfigUpdate,
} from "@solid-imager/core/domain/config/config-schema";
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
