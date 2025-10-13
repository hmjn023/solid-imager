# Data Model for Effect.ts Refactoring

This feature is primarily a backend refactoring and does not introduce new database entities. The primary addition to our data model is the introduction of a typed error for database operations.

## Error Model

### `DbError`

This is a generic, tagged error class that will be used to represent any failure originating from the database layer.

**Type**: `class`
**Extends**: `Data.TaggedError`

**Attributes**:

| Name  | Type    | Description                                      |
|-------|---------|--------------------------------------------------|
| `cause` | `unknown` | The original error or exception that was caught. |

**Example**:

```typescript
import { Data } from "effect";

export class DbError extends Data.TaggedError("DbError")<{
  readonly cause: unknown;
}> {}
```
