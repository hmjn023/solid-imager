# API Contract: Media List

**Endpoint**: `GET /api/sources/:sourceId/directories/[...directories]`

**Description**: Retrieves a list of media and subdirectories within a specific directory of a media source.

## Request

-   **URL Parameters**:
    -   `sourceId` (UUID): The ID of the media source.
    -   `directories` (string): The path to the directory.
-   **Query Parameters**:
    -   `page` (number, optional, default: 1): The page number for pagination.
    -   `pageSize` (number, optional, default: 50): The number of items per page.

## Response

-   **Success (200 OK)**:

    ```json
    {
      "media": [
        {
          "id": "uuid-string",
          "file_name": "image.png",
          "media_type": "image",
          "width": 1024,
          "height": 768
        }
      ],
      "directories": [
        {
          "name": "sub-folder",
          "path": "path/to/sub-folder"
        }
      ],
      "pagination": {
        "currentPage": 1,
        "pageSize": 50,
        "totalItems": 1,
        "totalPages": 1
      }
    }
    ```

-   **Error (404 Not Found)**: If the source or directory does not exist.
-   **Error (500 Internal Server Error)**: For any other server-side errors.
