/**
 * Categories Domain Types
 * Extracted from src/lib/types.ts during architecture reorganization
 */

export type CategoryData = {
  name: string;
  description?: string;
  color?: string;
  parentId?: number;
};
