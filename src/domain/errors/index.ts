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

export class ValidationError extends DomainError {}

export class UnexpectedError extends DomainError {
  readonly originalError?: unknown;

  constructor(message: string, originalError?: unknown) {
    super(message);
    this.originalError = originalError;
  }
}
