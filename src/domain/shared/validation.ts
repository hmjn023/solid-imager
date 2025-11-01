/**
 * Schema Validation Utilities
 * Extracted from src/lib/helpers/data-transformer.ts
 * Feature 17.3: データ変換 / 検証
 */

import type { ZodSchema } from "zod";

/**
 * Provides utility functions for validating data against Zod schemas.
 */
export const SchemaValidator = {
  /**
   * Validates the given data against a Zod schema.
   * @param {ZodSchema} _schema - The Zod schema to validate against.
   * @param {unknown} _data - The data to be validated.
   * @returns {unknown} The validated data, or throws a ZodError if validation fails.
   */
  validate(_schema: ZodSchema, _data: unknown): unknown {
    // TODO: Validate data against Zod schema
    throw new Error("Not implemented");
  },
};
