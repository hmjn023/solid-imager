# Feature Specification: Media Tag Search

## 1. Description

This feature enables users to search for media items within a specific media source based on one or more associated tags. It provides a dedicated API endpoint to filter media collections, allowing for more targeted discovery of assets.

## 2. User Scenarios

- **Scenario 1: Basic Search**
  - As a user, I want to find all images tagged with "landscape" so that I can see all my landscape shots in one place.

- **Scenario 2: Combined Search**
  - As a user, I want to find all images tagged with both "character-design" and "concept-art" to locate specific conceptual character drawings.

- **Scenario 3: No Results**
  - As a user, when I search for a tag that has no associated media, I expect to see an empty result set, confirming that no items match my criteria.

## 3. Functional Requirements

- **FR1: API Endpoint**
  - The system **MUST** provide a `GET` endpoint at `/api/sources/{mediaSourceId}/search`.

- **FR2: Tag-Based Filtering**
  - The endpoint **MUST** accept a comma-separated list of tags via a query parameter named `tags` (e.g., `?tags=landscape,sunset`).

- **FR3: Search Logic**
  - The search **MUST** return only media items that are associated with **ALL** of the provided tags (logical AND).
  - The search **MUST** be scoped to the media source identified by `{mediaSourceId}`.
  - The tag matching **MUST** be case-insensitive.

- **FR4: Response Format**
  - The endpoint **MUST** return a paginated list of media objects, consistent with the structure of other media list endpoints in the application.

- **FR5: Edge Case Handling**
  - If the `tags` query parameter is missing, empty, or contains only whitespace, the endpoint **MUST** return an HTTP `400 Bad Request` response.
  - If no media items match the provided tags, the endpoint **MUST** return an empty array `[]` in the response body.

## 4. Success Criteria

- **SC1: Accuracy**
  - A search for one or more tags returns a dataset where 100% of the items contain all the specified tags.

- **SC2: Performance**
  - For a media source containing 10,000 items, the P95 response time for a search query with 1-3 tags **MUST** be under 2 seconds.

- **SC3: Correctness**
  - A request to the search endpoint without a `tags` query parameter successfully returns a `400 Bad Request` status.

## 5. Key Entities

- **Media**: The core entity representing an image or other asset.
- **Tag**: A label associated with a Media item.
- **MediaSource**: The collection or repository where media is stored.

## 6. Assumptions

- The underlying data model supports efficient querying of media by their associated tags (e.g., through a join table or indexed array).
- The user-provided feature description implies that tag and media relationship data is already available for querying.

## 7. Out of Scope

- Complex search queries involving logical OR or tag exclusion (e.g., `NOT "draft"`).
- Full-text search on media metadata other than tags.
- A user interface for consuming the search functionality. This specification is for the API endpoint only.