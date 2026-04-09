import type {
	SearchCriterion,
	SearchGroup,
} from "@solid-imager/core/domain/media/schemas";
import type { TauriSearchFilterState } from "../components/media/search-filters";
import type { MockMedia } from "../mocks/demo-data";

function getStringValues(media: MockMedia, target: SearchCriterion["target"]) {
	switch (target) {
		case "fileName":
			return [media.fileName];
		case "filePath":
			return [media.filePath];
		case "description":
			return [media.description];
		case "keyword":
			return [
				media.fileName,
				media.title,
				media.summary,
				...media.tags,
				...media.authors.map((author) => author.name),
				...media.projects.map((project) => project.name),
				...media.ips.map((ip) => ip.name),
				...media.characters.map((character) => character.name),
			];
		case "tag":
			return [...media.tags];
		case "author":
			return [
				...media.authors.map((author) => author.id),
				...media.authors.map((author) => author.name),
			];
		case "project":
			return [
				...media.projects.map((project) => project.id),
				...media.projects.map((project) => project.name),
			];
		case "ip":
			return [
				...media.ips.map((ip) => ip.id),
				...media.ips.map((ip) => ip.name),
			];
		case "character":
			return [
				...media.characters.map((character) => character.id),
				...media.characters.map((character) => character.name),
			];
		case "folder":
			return [media.filePath.split("/").slice(0, -1).join("/")];
		default:
			return [];
	}
}

function getNumericValue(media: MockMedia, target: SearchCriterion["target"]) {
	switch (target) {
		case "rating":
			return media.rating;
		case "viewCount":
			return media.viewCount;
		case "fileSize":
			return media.fileSize;
		case "createdAt":
			return Date.parse(media.modifiedAt);
		case "width":
			return media.width;
		case "height":
			return media.height;
		default:
			return null;
	}
}

function getBooleanValue(media: MockMedia, target: SearchCriterion["target"]) {
	switch (target) {
		case "aiGenerated":
			return Boolean(media.generationInfo);
		case "favorite":
			return media.favorite;
		default:
			return null;
	}
}

function evaluateCriterion(media: MockMedia, criterion: SearchCriterion) {
	const { operator, target, value } = criterion;

	if (
		[
			"rating",
			"viewCount",
			"fileSize",
			"createdAt",
			"width",
			"height",
		].includes(target)
	) {
		const actual = getNumericValue(media, target);
		const expected = typeof value === "number" ? value : Number(value);
		if (actual == null || Number.isNaN(expected)) {
			return false;
		}
		switch (operator) {
			case "equals":
				return actual === expected;
			case "gt":
				return actual > expected;
			case "gte":
				return actual >= expected;
			case "lt":
				return actual < expected;
			case "lte":
				return actual <= expected;
			default:
				return false;
		}
	}

	if (["aiGenerated", "favorite"].includes(target)) {
		const actual = getBooleanValue(media, target);
		if (actual == null || typeof value !== "boolean") {
			return false;
		}
		return operator === "equals" ? actual === value : false;
	}

	const actualValues = getStringValues(media, target)
		.map((item) => item.toLowerCase())
		.filter((item) => item.length > 0);

	if (operator === "isEmpty") {
		return actualValues.length === 0;
	}
	if (operator === "isNotEmpty") {
		return actualValues.length > 0;
	}
	if (operator === "in" || operator === "notIn") {
		const expectedValues = Array.isArray(value)
			? value.map((item) => String(item).toLowerCase())
			: [];
		const matched = expectedValues.some((expected) =>
			actualValues.some((actual) => actual === expected),
		);
		return operator === "in" ? matched : !matched;
	}

	const expected = String(value ?? "").toLowerCase();
	if (!expected) {
		return false;
	}

	return actualValues.some((actual) => {
		switch (operator) {
			case "equals":
				return actual === expected;
			case "contains":
				return actual.includes(expected);
			case "startsWith":
				return actual.startsWith(expected);
			case "endsWith":
				return actual.endsWith(expected);
			default:
				return false;
		}
	});
}

export function matchesSearchGroup(
	media: MockMedia,
	group: SearchGroup | null,
): boolean {
	if (!group || group.children.length === 0) {
		return true;
	}

	const results: boolean[] = group.children.map((child) =>
		child.type === "group"
			? matchesSearchGroup(media, child)
			: evaluateCriterion(media, child),
	);

	const matched: boolean =
		group.operator === "and" ? results.every(Boolean) : results.some(Boolean);
	return group.negate ? !matched : matched;
}

export function createDefaultAdvancedCondition(state: TauriSearchFilterState) {
	const children: SearchGroup["children"] = [];

	if (state.searchQuery.trim()) {
		children.push({
			type: "criterion",
			target: "fileName",
			operator: "contains",
			value: state.searchQuery.trim(),
		});
	}
	for (const tag of state.selectedTags) {
		children.push({
			type: "criterion",
			target: "tag",
			operator: "equals",
			value: tag,
		});
	}
	for (const tag of state.excludeTags) {
		children.push({
			type: "criterion",
			target: "tag",
			operator: "notIn",
			value: [tag],
		});
	}
	for (const authorId of state.selectedAuthors) {
		children.push({
			type: "criterion",
			target: "author",
			operator: "equals",
			value: authorId,
		});
	}
	for (const projectId of state.selectedProjects) {
		children.push({
			type: "criterion",
			target: "project",
			operator: "equals",
			value: projectId,
		});
	}
	if (state.favoritesOnly) {
		children.push({
			type: "criterion",
			target: "favorite",
			operator: "equals",
			value: true,
		});
	}

	return {
		type: "group",
		operator: "and",
		children,
	} satisfies SearchGroup;
}

export function cloneSearchGroup(group: SearchGroup | null) {
	return group ? (JSON.parse(JSON.stringify(group)) as SearchGroup) : null;
}
