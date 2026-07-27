export class NonRetryableJobError extends Error {
	readonly code: string;

	constructor(code: string, message: string) {
		super(message);
		this.name = "NonRetryableJobError";
		this.code = code;
	}
}
