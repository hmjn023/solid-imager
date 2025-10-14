import { Data } from "effect";
import type { AppError } from "~/shared/types/app-error";

export class DbError extends Data.TaggedClass("DbError")<{
  readonly message: string;
  readonly details?: Record<string, unknown>;
}> implements AppError {
  readonly _tag = "DbError";
}

export class NotFoundError extends Data.TaggedClass("NotFoundError")<{
  readonly message: string;
  readonly details?: Record<string, unknown>;
}> implements AppError {
  readonly _tag = "NotFoundError";
}

export class AlreadyExistsError extends Data.TaggedClass("AlreadyExistsError")<{
  readonly message: string;
  readonly details?: Record<string, unknown>;
}> implements AppError {
  readonly _tag = "AlreadyExistsError";
}

export class InvalidInputError extends Data.TaggedClass("InvalidInputError")<{
  readonly message: string;
  readonly details?: Record<string, unknown>;
}> implements AppError {
  readonly _tag = "InvalidInputError";
}

export class ConstraintError extends Data.TaggedClass("ConstraintError")<{
  readonly message: string;
  readonly details?: Record<string, unknown>;
}> implements AppError {
  readonly _tag = "ConstraintError";
}

export class UnknownDbError extends Data.TaggedClass("UnknownDbError")<{
  readonly message: string;
  readonly details?: Record<string, unknown>;
}> implements AppError {
  readonly _tag = "UnknownDbError";
}
