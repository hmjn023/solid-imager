# Unfinished processing recovery

Jobs → Media processing → Recover unfinished processing scans active local media. Select Metadata, Thumbnails, AI tagging or Full-image CCIP, optionally select a local source, and enter a filename filter. Find unfinished shows counts and up to ten examples; Queue unfinished scans the scope again and submits eligible work through existing durable batches. Individual unrequested or outdated steps also have a Queue action in the processing details.

| Operation | Detection and resubmission |
| --- | --- |
| Metadata extraction | Missing request, failed, outdated, abandoned pending request, or completed request without a generation-info row. An empty row is a valid extraction result. |
| Thumbnails | Same request checks; completed work must have both 256px and 512px files. Applies to images and video. |
| AI tagging | Same request checks; completed work must have a valid persisted tagging response. Empty tag collections are valid. |
| Full-image CCIP | Same request checks; vector metadata must match the current processing revision, model and embedding version. The scan does not run inference or load vector contents. |
| Directory sync | Sources already provides Sync. Retry uses the durable source run. A file not yet discovered by sync is outside the media-processing scan. |
| Download/import | Imports and URL submission create intended download work; Jobs retries recoverable download runs. Unapproved import requests remain in Imports. Media scans cannot reconstruct an unknown URL. |
| Export/restore | Manager/source operations provide submission; Jobs retries while retained inputs remain available. A missing export is not inferred from the media library. |
| Retired LanceDB operations / blocked legacy runs | No automatic recreation. Their original operation/input must be reviewed instead of inferred. |

Metadata, tagging and CCIP apply to images. Normal current pending/in-progress requests and targets already held by an active batch are excluded. A request left pending without independent or live batch demand can be recovered explicitly. New demand can reuse an existing current request; it does not create a second execution queue.

Each API call scans at most 100 applicable media with an ID keyset cursor and a fixed database timestamp cutoff. Continue `processing.scanRecovery` / `processing.enqueueRecovery` until the cursor is null, including pages with no matches. New media added during the scan are picked up by the next scan. Enqueue captures at most 100 targets in each existing batch, rechecks eligibility, and keeps file/AI schedulers as the sole executors. A target completed between inspection and capture is skipped.

The UI updates counts after every page. Stop or navigation ends further page requests; committed batches remain visible in Job history and can be cancelled there. If a response is lost after commit, a fresh scan detects the queued batch instead of submitting its items again. There is no 200-item selection limit on this scan. Starting another scan safely picks up remaining eligible work after a partial failure.

Apply migration 0047 before using this version. It adds the partial active-item index used to check batch membership efficiently; it does not enqueue, delete or change media. Recovery itself is an explicit user action and respects source/filename scope.
