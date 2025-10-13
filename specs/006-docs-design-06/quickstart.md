# Quickstart: Media Delivery and Media List

This guide explains how to use the API endpoints for listing media and retrieving thumbnails.

## Listing Media in a Directory

To get a list of media and subdirectories, make a `GET` request to:

```
/api/sources/{sourceId}/directories/{directoryPath}
```

**Example using `curl`**:

```bash
curl http://localhost:3000/api/sources/a1b2c3d4-e5f6-7890-1234-567890abcdef/directories/my-folder
```

This will return a JSON response containing the media and directories in `my-folder`.

## Retrieving a Thumbnail

To get a thumbnail for a media file, make a `GET` request to:

```
/api/sources/{sourceId}/{mediaId}/thumbnail
```

You can also specify a size using the `size` query parameter:

```
/api/sources/{sourceId}/{mediaId}/thumbnail?size=400
```

**Example using `curl`**:

```bash
cURL http://localhost:3000/api/sources/a1b2c3d4-e5f6-7890-1234-567890abcdef/m1n2o3p4-q5r6-7890-1234-567890abcdef/thumbnail?size=400 > thumbnail.webp
```

This will download the 400px wide thumbnail and save it as `thumbnail.webp`.
