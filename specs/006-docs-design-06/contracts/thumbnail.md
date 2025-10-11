# API Contract: Thumbnail

**Endpoint**: `GET /api/sources/:sourceId/:mediaId/thumbnail`

**Description**: Retrieves a thumbnail for a specific media file.

## Request

-   **URL Parameters**:
    -   `sourceId` (UUID): The ID of the media source.
    -   `mediaId` (UUID): The ID of the media file.
-   **Query Parameters**:
    -   `size` (number, optional, default: 200): The desired width of the thumbnail in pixels. The height will be scaled proportionally.

## Response

-   **Success (200 OK)**:
    -   The response body will be the thumbnail image data (e.g., `image/webp`).

-   **Error (404 Not Found)**: If the media file does not exist.
-   **Error (500 Internal Server Error)**: If thumbnail generation fails.
