# Feature Specification: Media Delivery and Media List

**Feature Branch**: `006-docs-design-06`
**Created**: 2025-10-11
**Status**: Draft
**Input**: User description: "@docs/design/06-feature-details.md の### 4. メディア配信 & メディア一覧を開発する すでにあるプレースホルダー関数を活用すること、また ./docsを参照することで既存の決定に従うこと"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View Media in a Directory (Priority: P1)

As a user, I want to see a list of all media files within a specific directory of a media source, so that I can browse my collection.

**Why this priority**: This is the most fundamental feature for browsing media.

**Independent Test**: Can be tested by navigating to a directory view and verifying that the media list is displayed correctly.

**Acceptance Scenarios**:

1.  **Given** a media source with several media files in a directory, **When** I navigate to that directory's page, **Then** I should see a grid of thumbnails for all the media in that directory.
2.  **Given** a directory with no media files, **When** I navigate to that directory's page, **Then** I should see a message indicating that there are no media files.

---

### User Story 2 - View a Specific Media's Thumbnail (Priority: P2)

As a user, I want to be able to view a thumbnail of a specific media file, so that I can get a quick preview.

**Why this priority**: Essential for the media list view.

**Independent Test**: Can be tested by calling the thumbnail API endpoint directly.

**Acceptance Scenarios**:

1.  **Given** a valid media ID, **When** I request its thumbnail with a specific size, **Then** the system should return the correctly sized thumbnail image.
2.  **Given** an invalid media ID, **When** I request its thumbnail, **Then** the system should return a 404 error.

---

## Requirements *(mandatory)*

### Functional Requirements

-   **FR-001**: The system MUST provide an API endpoint to list all media within a specific directory of a media source. (`DirectoryService.listMediaInSubdirectory`)
-   **FR-002**: The system MUST provide an API endpoint to deliver a thumbnail for a specific media file. (`ThumbnailService.getMediaThumbnail`)
-   **FR-003**: The thumbnail endpoint MUST accept a `size` query parameter to specify the thumbnail dimensions.
-   **FR-004**: The system MUST generate thumbnails in the background if they don't exist in the cache.
-   **FR-005**: The media list API response MUST be paginated.

### Key Entities *(include if feature involves data)*

-   **Media**: Represents a single media file. Attributes include `id`, `source_id`, `file_path`, `file_name`, `media_type`, `width`, `height`, `file_size`.
-   **MediaSource**: Represents a source of media files.
-   **Thumbnail**: A smaller, cached version of a media file.

## Success Criteria *(mandatory)*

### Measurable Outcomes

-   **SC-001**: The media list for a directory with 100 items loads in under 2 seconds.
-   **SC-002**: Thumbnail generation for a new image is completed within 5 seconds.
-   **SC-003**: The API endpoints for media list and thumbnails have a 99.9% success rate.