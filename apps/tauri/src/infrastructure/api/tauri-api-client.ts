import type { AppConfig } from "@solid-imager/core/domain/config/config-schema";
import type { TauriCommandClient } from "../tauri/command-client";

export type TauriApiProcedure = `${string}.${string}`;

type TauriApiCall = <TInput, TOutput>(
	procedure: TauriApiProcedure,
	input?: TInput,
) => Promise<TOutput>;

export type TauriApiClient = {
	call: TauriApiCall;
	config: {
		get(): Promise<AppConfig>;
		update(input: Partial<AppConfig>): Promise<AppConfig>;
	};
};

class TauriApiInvoker {
	constructor(private readonly commandClient: TauriCommandClient) {}

	call<TInput, TOutput>(
		procedure: TauriApiProcedure,
		input?: TInput,
	): Promise<TOutput> {
		return this.commandClient.invoke<TOutput>("api_call", {
			procedure,
			input,
		});
	}
}

export function createTauriApiClient(
	commandClient: TauriCommandClient,
): TauriApiClient {
	const invoker = new TauriApiInvoker(commandClient);

	return {
		call: <TInput, TOutput>(procedure: TauriApiProcedure, input?: TInput) =>
			invoker.call<TInput, TOutput>(procedure, input),
		config: {
			get: () => invoker.call<undefined, AppConfig>("config.get"),
			update: (input: Partial<AppConfig>) =>
				invoker.call<Partial<AppConfig>, AppConfig>("config.update", input),
		},
	};
}
