/**
 * Custom error class for database constraint violations.
 * @property {string} _tag - A unique identifier for the error type.
 * @property {unknown} [details] - Optional additional details about the constraint error.
 */
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
/**
 * Custom error class for when a requested resource is not found in the database.
 * @property {string} _tag - A unique identifier for the error type.
 * @property {unknown} [details] - Optional additional details about the not found error.
 */
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
/**
 * Custom error class for generic or unknown database errors.
 * @property {string} _tag - A unique identifier for the error type.
 * @property {unknown} [details] - Optional additional details about the unknown database error.
 */
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
