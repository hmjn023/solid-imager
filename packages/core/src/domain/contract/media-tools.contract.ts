import { oc } from "@orpc/contract";
import { openapi } from "@orpc/openapi";
import { mediaToolInputs, mediaToolOutputs } from "../media/tool-schemas";

const tool = oc.meta(openapi({ tags: ["Media Tools"] }));
export const mediaToolsContract = {
	list_sources: tool
		.meta(
			openapi({
				description:
					"List registered media sources and their IDs. Check for an existing local path before creating a source.",
			}),
		)
		.input(mediaToolInputs.list_sources)
		.output(mediaToolOutputs.list_sources),
	create_local_source: tool
		.meta(
			openapi({
				description:
					"Register a local directory on the server as a media source. Starts file monitoring and an initial scan. Check list_sources first to avoid duplicate registrations.",
			}),
		)
		.input(mediaToolInputs.create_local_source)
		.output(mediaToolOutputs.create_local_source),
	search_media: tool
		.meta(
			openapi({
				description:
					"Search the media library by keyword or tag. Omit the filters to browse the newest media. Use each item's mediaSourceId and id for details or tag edits.",
			}),
		)
		.input(mediaToolInputs.search_media)
		.output(mediaToolOutputs.search_media),
	get_media_details: tool
		.meta(
			openapi({
				description:
					"Get a media item's metadata, generation parameters, authors, characters, IPs and assigned tags.",
			}),
		)
		.input(mediaToolInputs.get_media_details)
		.output(mediaToolOutputs.get_media_details),
	find_tags: tool
		.meta(
			openapi({
				description:
					"Look up existing library tags by name to get their IDs for editing media.",
			}),
		)
		.input(mediaToolInputs.find_tags)
		.output(mediaToolOutputs.find_tags),
	edit_media_tags: tool
		.meta(
			openapi({
				description:
					"Add existing tags to one media item as positive tags, or remove both positive and negative assignments for the specified tag IDs.",
			}),
		)
		.input(mediaToolInputs.edit_media_tags)
		.output(mediaToolOutputs.edit_media_tags),
};
