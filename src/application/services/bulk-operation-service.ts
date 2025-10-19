/**
 * BulkOperationService - バルク操作機能
 * Feature 15: バルク操作機能
 */

export const BulkOperationService = {
  // Feature 15: バルク操作機能
  bulkEditMedia(_sourceId: string, _mediaIds: string[], _updates: unknown) {
    // TODO: Bulk edit multiple media
    throw new Error("Not implemented");
  },

  bulkDeleteMedia(_sourceId: string, _mediaIds: string[]) {
    // TODO: Bulk delete multiple media
    throw new Error("Not implemented");
  },

  bulkMoveMedia(
    _sourceId: string,
    _mediaIds: string[],
    _destinationPath: string
  ) {
    // TODO: Bulk move media to destination
    throw new Error("Not implemented");
  },

  bulkTagMedia(
    _sourceId: string,
    _mediaIds: string[],
    _tagsToAdd: number[],
    _tagsToRemove: number[]
  ) {
    // TODO: Bulk add/remove tags
    throw new Error("Not implemented");
  },
};
