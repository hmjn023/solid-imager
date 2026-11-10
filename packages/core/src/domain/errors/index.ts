export abstract class DomainError extends Error {
	constructor(message: string) {
		super(message);
		this.name = this.constructor.name;
		Object.setPrototypeOf(this, new.target.prototype);
	}
}

export class ResourceNotFoundError extends DomainError {
	readonly resource: string;
	readonly identifier?: string | number;

	constructor(resource: string, identifier?: string | number) {
		const message = identifier
			? `${resource} with identifier ${identifier} was not found.`
			: `${resource} was not found.`;
		super(message);
		this.resource = resource;
		this.identifier = identifier;
	}
}

export class ResourceConflictError extends DomainError {}

export class MediaFileConflictError extends DomainError {
	constructor(readonly filePath: string) {
		super(`Media file already exists: ${filePath}`);
	}
}

/** Storage side effects remain after a failed operation; replay requires reconciliation. Causes are internal log data, never an API response. */
export class UnreconciledStorageError extends AggregateError {
	constructor(errors: readonly unknown[]) {
		super(errors, "Storage cleanup requires reconciliation before retry.");
		this.name = "UnreconciledStorageError";
	}
}

export class ValidationError extends DomainError {}

export class UnexpectedError extends DomainError {
	readonly originalError?: unknown;

	constructor(message: string, originalError?: unknown) {
		super(message);
		this.originalError = originalError;
	}
}
