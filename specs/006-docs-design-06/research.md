# Research: Media Delivery and Media List

## Existing Codebase Analysis

- **Project Structure**: The project follows a clean architecture with `application`, `domain`, `infrastructure`, `presentation` layers.
- **Services**: Placeholder services exist in `src/application/services`:
    - `DirectoryService` (`src/application/services/directory-service.ts`)
    - `ThumbnailService` (`src/application/services/thumbnail-service.ts`)
- **API Routes**: API routes are located in `src/routes/api`.

## Implementation Strategy

### Media List (`DirectoryService.listMediaInSubdirectory`)

1.  **Retrieve Media Source**: Fetch the media source details (especially the base path for `local` sources) from the database using the provided `sourceId`.
2.  **Construct Path**: Combine the media source's base path with the `directoriesPath` to get the full absolute path to the target directory.
3.  **Read Directory**: Use Node.js `fs` module (`readdir`) to get the contents of the directory.
4.  **Filter Media**: Iterate through the directory contents and filter for files that match the supported media formats (e.g., `.png`, `.jpg`).
5.  **Return Data**: Return a list of media file names or objects containing more details.

### Thumbnail Delivery (`ThumbnailService.getMediaThumbnail`)

1.  **Retrieve Media**: Fetch the media details (especially `file_path`) from the database using the `mediaId`.
2.  **Cache Path**: Define a caching directory (e.g., `node_modules/.cache/thumbnails`). The thumbnail path will be something like `.../.cache/thumbnails/{sourceId}/{mediaId}-{size}.webp`.
3.  **Cache Check**: Check if the thumbnail already exists at the constructed cache path.
4.  **Serve from Cache**: If the thumbnail exists, serve the file directly.
5.  **Generate Thumbnail**: If the thumbnail does not exist:
    a.  Construct the full path to the original image.
    b.  Use the `sharp` library to read the image, resize it to the specified `size`, and convert it to `webp` format for efficiency.
    c.  Save the generated thumbnail to the cache path.
    d.  Serve the newly generated thumbnail.

### API Routes

-   **Media List**: Create a new route file at `src/routes/api/sources/[sourceId]/directories/[...directories].ts`. This will handle `GET` requests to `/api/sources/:sourceId/directories/...`.
-   **Thumbnail**: Create a new route file at `src/routes/api/sources/[sourceId]/[mediaId]/thumbnail.ts`. This will handle `GET` requests to `/api/sources/:sourceId/:mediaId/thumbnail`.

## Dependencies

-   `sharp`: For image processing (thumbnail generation). This is already listed as a dependency in `GEMINI.md`.
-   `fs-extra`: Potentially useful for ensuring cache directories exist.

## Open Questions

-   Where should the thumbnail cache directory be located? `node_modules/.cache/thumbnails` is a good candidate as it's often git-ignored and treated as a temporary location.
-   What specific information should be returned for the media list? Just file names, or more detailed objects from the `media` table?
