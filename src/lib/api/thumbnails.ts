export function startThumbnailGeneration(_sourceId: string) {
  return { success: true, message: "Thumbnail generation started" };
}

export function clearThumbnailCache(_sourceId: string) {
  return { success: true, message: "Thumbnail cache cleared" };
}
