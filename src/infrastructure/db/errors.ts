export class ConstraintError extends Error {
  readonly _tag = "ConstraintError";
  details?: unknown;
  constructor(options: { message?: string; details?: unknown }) {
    super(options.message);
    this.name = "ConstraintError";
    if (options.details) {
      this.details = options.details;
    }
  }
}

export class NotFoundError extends Error {
  readonly _tag = "NotFoundError";
  details?: unknown;
  constructor(options: { message?: string; details?: unknown }) {
    super(options.message);
    this.name = "NotFoundError";
    if (options.details) {
      this.details = options.details;
    }
  }
}

export class UnknownDbError extends Error {
  readonly _tag = "UnknownDbError";
  details?: unknown;
  constructor(options: { message?: string; details?: unknown }) {
    super(options.message);
    this.name = "UnknownDbError";
    if (options.details) {
      this.details = options.details;
    }
  }
}
