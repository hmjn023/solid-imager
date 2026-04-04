export class UnsupportedRuntimeError extends Error {
	readonly code = "UNSUPPORTED_RUNTIME";

	constructor(message: string) {
		super(message);
		this.name = "UnsupportedRuntimeError";
	}
}
