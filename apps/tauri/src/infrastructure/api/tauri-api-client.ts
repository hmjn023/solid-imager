import type { AppConfig } from "@solid-imager/core/domain/config/config-schema";
import { invokeLocalProcedure } from "../api-clients/local-procedures";

export type TauriApiProcedure = Parameters<typeof invokeLocalProcedure>[0];

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
	call<TInput, TOutput>(
		procedure: TauriApiProcedure,
		input?: TInput,
	): Promise<TOutput> {
		return invokeLocalProcedure(procedure, input) as Promise<TOutput>;
	}
}

export function createTauriApiClient(): TauriApiClient {
	const invoker = new TauriApiInvoker();

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
