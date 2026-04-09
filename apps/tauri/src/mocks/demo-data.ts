export type MockSourceStatus = "watching" | "idle" | "attention";
export type MockMediaStatus = "queued" | "review" | "tagged";

export interface MockSource {
	id: string;
	name: string;
	type: "folder" | "watcher" | "import";
	path: string;
	description: string;
	status: MockSourceStatus;
	lastSync: string;
	mediaCount: number;
	accent: string;
}

export interface MockMedia {
	id: string;
	sourceId: string;
	sourceName: string;
	title: string;
	summary: string;
	status: MockMediaStatus;
	rating: number;
	updatedAt: string;
	resolution: string;
	author: string;
	tags: string[];
	accent: string;
	prompt: string;
	favorite: boolean;
}

export interface MockEntity {
	id: string;
	name: string;
	description: string;
	itemCount: number;
}

export interface MockCharacter extends MockEntity {
	ipIds: string[];
}

export interface MockConfig {
	jobs: {
		concurrency: number;
		aiConcurrency: number;
		pollIntervalMs: number;
		enableAutoTagging: boolean;
	};
	ai: {
		baseUrl: string;
		timeoutMs: number;
		autoAnalyzePrompt: boolean;
	};
	downloads: {
		rateLimitEnabled: boolean;
		requestIntervalMs: number;
	};
	storage: {
		thumbnailDir: string;
		thumbnailSize: number;
		originalDir: string;
	};
	logging: {
		level: "debug" | "info" | "warn";
		retentionDays: number;
		enableConsoleMirror: boolean;
	};
}

export const mockSources: MockSource[] = [
	{
		id: "src-local",
		name: "Local Generations",
		type: "folder",
		path: "/mnt/media/generations",
		description: "Stable Diffusion output watched from the workstation.",
		status: "watching",
		lastSync: "2 minutes ago",
		mediaCount: 18,
		accent: "linear-gradient(135deg, #0f766e, #14b8a6)",
	},
	{
		id: "src-board",
		name: "Reference Board",
		type: "watcher",
		path: "/mnt/media/reference-board",
		description: "Curated references for tagging and project assignment.",
		status: "idle",
		lastSync: "18 minutes ago",
		mediaCount: 11,
		accent: "linear-gradient(135deg, #1d4ed8, #60a5fa)",
	},
	{
		id: "src-inbox",
		name: "Import Inbox",
		type: "import",
		path: "/mnt/media/import-inbox",
		description: "New files dropped by external tools before review.",
		status: "attention",
		lastSync: "yesterday",
		mediaCount: 7,
		accent: "linear-gradient(135deg, #b45309, #f59e0b)",
	},
];

export const mockMedia: MockMedia[] = [
	{
		id: "media-aurora-room",
		sourceId: "src-local",
		sourceName: "Local Generations",
		title: "Aurora Room",
		summary:
			"Interior render with teal ambient lighting and glass reflections.",
		status: "tagged",
		rating: 5,
		updatedAt: "2026-04-09 09:20",
		resolution: "1536x1024",
		author: "nova",
		tags: ["interior", "teal", "lighting"],
		accent: "linear-gradient(135deg, #0f766e, #34d399)",
		prompt:
			"cinematic room interior, glass reflections, teal ambient light, volumetric haze",
		favorite: true,
	},
	{
		id: "media-rain-alley",
		sourceId: "src-local",
		sourceName: "Local Generations",
		title: "Rain Alley",
		summary: "Street scene with neon signage and reflective asphalt.",
		status: "review",
		rating: 4,
		updatedAt: "2026-04-09 08:52",
		resolution: "1216x832",
		author: "nova",
		tags: ["city", "night", "neon"],
		accent: "linear-gradient(135deg, #312e81, #8b5cf6)",
		prompt:
			"rainy alley, anime city, neon signs, wet asphalt, moody atmosphere",
		favorite: false,
	},
	{
		id: "media-botanical-study",
		sourceId: "src-local",
		sourceName: "Local Generations",
		title: "Botanical Study",
		summary: "Macro composition of leaves and dew with painterly texture.",
		status: "queued",
		rating: 3,
		updatedAt: "2026-04-08 21:13",
		resolution: "1024x1024",
		author: "flora",
		tags: ["macro", "nature", "study"],
		accent: "linear-gradient(135deg, #166534, #4ade80)",
		prompt: "botanical close-up, dewdrops, painterly brushwork, natural study",
		favorite: false,
	},
	{
		id: "media-hero-sheet",
		sourceId: "src-board",
		sourceName: "Reference Board",
		title: "Hero Sheet",
		summary: "Character turnaround with costume variations and callouts.",
		status: "tagged",
		rating: 5,
		updatedAt: "2026-04-08 18:31",
		resolution: "2048x1536",
		author: "atelier",
		tags: ["character", "sheet", "reference"],
		accent: "linear-gradient(135deg, #1d4ed8, #93c5fd)",
		prompt:
			"hero character sheet, turnaround, costume notes, polished concept art",
		favorite: true,
	},
	{
		id: "media-prop-board",
		sourceId: "src-board",
		sourceName: "Reference Board",
		title: "Prop Board",
		summary: "Assorted props collected for batch tagging verification.",
		status: "review",
		rating: 4,
		updatedAt: "2026-04-08 14:05",
		resolution: "1600x1200",
		author: "atelier",
		tags: ["props", "reference", "batch"],
		accent: "linear-gradient(135deg, #0f172a, #475569)",
		prompt: "prop board, industrial gadgets, reference layout, clean labels",
		favorite: false,
	},
	{
		id: "media-courtyard-dawn",
		sourceId: "src-inbox",
		sourceName: "Import Inbox",
		title: "Courtyard Dawn",
		summary: "Warm sunrise scene pending first-pass metadata cleanup.",
		status: "queued",
		rating: 2,
		updatedAt: "2026-04-08 11:10",
		resolution: "1344x768",
		author: "orbit",
		tags: ["environment", "sunrise", "courtyard"],
		accent: "linear-gradient(135deg, #b45309, #fbbf24)",
		prompt:
			"courtyard at dawn, warm fog, soft architecture, concept matte painting",
		favorite: false,
	},
	{
		id: "media-signal-lab",
		sourceId: "src-inbox",
		sourceName: "Import Inbox",
		title: "Signal Lab",
		summary: "Tech lab environment imported from an external render queue.",
		status: "review",
		rating: 4,
		updatedAt: "2026-04-07 23:44",
		resolution: "1792x1024",
		author: "orbit",
		tags: ["lab", "technology", "environment"],
		accent: "linear-gradient(135deg, #7c2d12, #fb923c)",
		prompt:
			"sci-fi laboratory, signal monitors, clean industrial interior, orange light",
		favorite: true,
	},
	{
		id: "media-mecha-note",
		sourceId: "src-board",
		sourceName: "Reference Board",
		title: "Mecha Note",
		summary: "Annotated mechanical silhouette sheet for quick comparison.",
		status: "tagged",
		rating: 5,
		updatedAt: "2026-04-07 20:02",
		resolution: "1400x1400",
		author: "atelier",
		tags: ["mecha", "sheet", "annotation"],
		accent: "linear-gradient(135deg, #334155, #94a3b8)",
		prompt:
			"mecha silhouette sheet, annotation arrows, industrial concept sketch",
		favorite: true,
	},
];

export const mockProjects: MockEntity[] = [
	{
		id: "project-starlit",
		name: "Starlit District",
		description: "Urban night scenes collected for search and curation tests.",
		itemCount: 12,
	},
	{
		id: "project-orchard",
		name: "Orchard Atlas",
		description: "Botanical and daylight compositions used for tagging QA.",
		itemCount: 8,
	},
];

export const mockIps: MockEntity[] = [
	{
		id: "ip-astral",
		name: "Astral Blocks",
		description: "Shared visual language for neon city assets.",
		itemCount: 21,
	},
	{
		id: "ip-vellum",
		name: "Vellum Archive",
		description: "Illustrative fantasy reference set.",
		itemCount: 9,
	},
];

export const mockCharacters: MockCharacter[] = [
	{
		id: "char-rin",
		name: "Rin Kisaragi",
		description: "Primary protagonist used in sheet and expression tests.",
		itemCount: 6,
		ipIds: ["ip-astral"],
	},
	{
		id: "char-sable",
		name: "Sable Unit",
		description: "Mechanical support character with alternate loadouts.",
		itemCount: 4,
		ipIds: ["ip-astral", "ip-vellum"],
	},
];

export const mockConfig: MockConfig = {
	jobs: {
		concurrency: 4,
		aiConcurrency: 2,
		pollIntervalMs: 1500,
		enableAutoTagging: true,
	},
	ai: {
		baseUrl: "http://127.0.0.1:8000",
		timeoutMs: 12000,
		autoAnalyzePrompt: true,
	},
	downloads: {
		rateLimitEnabled: true,
		requestIntervalMs: 750,
	},
	storage: {
		thumbnailDir: "/mnt/media/.thumbs",
		thumbnailSize: 640,
		originalDir: "/mnt/media/originals",
	},
	logging: {
		level: "info",
		retentionDays: 14,
		enableConsoleMirror: true,
	},
};

export const mockSearchTags = Array.from(
	new Set(mockMedia.flatMap((item) => item.tags)),
).sort();

export function getMockSource(sourceId: string) {
	return mockSources.find((source) => source.id === sourceId);
}

export function getMockMedia(mediaId: string) {
	return mockMedia.find((media) => media.id === mediaId);
}

export function getMockMediaBySource(sourceId: string) {
	return mockMedia.filter((media) => media.sourceId === sourceId);
}
