/**
 * Collections Domain Validation Schemas
 */

import { z } from "zod";

export const newCollectionSchema = z.object({
  name: z.string().min(1, "Collection name is required"),
  description: z.string().optional(),
  userId: z.string().uuid(),
});

export const updateCollectionSchema = z.object({
  name: z.string().min(1, "Collection name is required").optional(),
  description: z.string().optional(),
});

export type NewCollection = z.infer<typeof newCollectionSchema>;
export type UpdateCollection = z.infer<typeof updateCollectionSchema>;

export const collectionSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type Collection = z.infer<typeof collectionSchema>;

export const collectionItemSchema = z.object({
  collectionId: z.string().uuid(),
  mediaId: z.string().uuid(),
  displayOrder: z.number().int().optional(),
});

export type CollectionItem = z.infer<typeof collectionItemSchema>;

export const newCollectionItemSchema = z.object({
  mediaId: z.string().uuid(),
  displayOrder: z.number().int().optional(),
});

export type NewCollectionItem = z.infer<typeof newCollectionItemSchema>;
