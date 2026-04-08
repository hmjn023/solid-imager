export type TauriCommandClient = {
	invoke<TResponse>(
		command: string,
		payload?: Record<string, unknown>,
	): Promise<TResponse>;
};
