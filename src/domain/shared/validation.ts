/**
 * Schema Validation Utilities
 * Extracted from src/lib/helpers/data-transformer.ts
 * Feature 17.3: データ変換 / 検証
 */

import type { ZodSchema } from "zod";

export const SchemaValidator = {
  validate(_schema: ZodSchema, _data: unknown): unknown {
    // TODO: Validate data against Zod schema
    throw new Error("Not implemented");
  },
};
