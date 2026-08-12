import type { AppConfig } from "@solid-imager/core/domain/config/config-schema";
import type { QueryUiState } from "../query-state";

export type ConfigStateScreenProps = {
	class?: string;
	data?: AppConfig;
	onRetry: () => void | Promise<void>;
	onSubmit: (value: Partial<AppConfig>) => Promise<void>;
	onSubmitSuccess?: () => void;
	state: QueryUiState<AppConfig>;
};
