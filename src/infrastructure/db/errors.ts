import { Data } from "effect";

export class DbError extends Data.TaggedClass("DbError")<{
  readonly message: string;
  readonly origError?: unknown;
}> {}

export class NotFoundError extends Data.TaggedClass("NotFoundError")<{
  readonly message: string;
}> {
  readonly _tag = "NotFoundError";
}

export class AlreadyExistsError extends Data.TaggedClass("AlreadyExistsError")<{
  readonly message: string;
}> {
  readonly _tag = "AlreadyExistsError";
}

export class InvalidInputError extends Data.TaggedClass("InvalidInputError")<{
  readonly message: string;
}> {
  readonly _tag = "InvalidInputError";
}

export class UnknownDbError extends Data.TaggedClass("UnknownDbError")<{
  readonly message: string;
  readonly origError?: unknown;
}> {
  readonly _tag = "UnknownDbError";
}
