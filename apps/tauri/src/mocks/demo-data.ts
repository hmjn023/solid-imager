import type { MediaSourceTypeEnum } from "@solid-imager/core/domain/sources/schemas";

export type MockSourceStatus = "active" | "idle" | "error";
export type MockMediaStatus = "queued" | "review" | "tagged";
export type MockMediaType = "image" | "video" | "audio";
export type MockTagSource = "AI" | "comfyui_workflow" | "manual";
export type MockTagType = "positive" | "negative";

export type MockConnectionInfo =
	| { path: string }
	| { host: string; port: number; remotePath: string; username: string }
	| { bucket: string; prefix?: string; region: string };

export interface MockSource {
	id: string;
	name: string;
	description: string | null;
	type: MediaSourceTypeEnum;
	connectionInfo: MockConnectionInfo;
	status: MockSourceStatus;
	lastSync: string;
	mediaCount: number;
}

export interface MockAssociation {
	id: string;
	name: string;
}

export interface MockAuthor {
	accountId?: string;
	id: string;
	name: string;
}

export interface MockTag {
	name: string;
	source: MockTagSource;
	type: MockTagType;
}

export interface MockMediaUrl {
	url: string;
}

export interface MockGenerationInfo {
	negativePrompt?: string;
	prompt?: string;
	workflow?: Record<string, string | number | boolean>;
}

export interface MockMedia {
	authors: MockAuthor[];
	characters: MockAssociation[];
	description: string;
	favorite: boolean;
	fileName: string;
	filePath: string;
	fileSize: number;
	height: number;
	id: string;
	ips: MockAssociation[];
	mediaSourceId: string;
	mediaType: MockMediaType;
	modifiedAt: string;
	negativeTags: MockTag[];
	positiveTags: MockTag[];
	projects: MockAssociation[];
	prompt: string;
	rating: number;
	resolution: string;
	sourceName: string;
	status: MockMediaStatus;
	summary: string;
	tags: string[];
	title: string;
	updatedAt: string;
	urls: MockMediaUrl[];
	viewCount: number;
	width: number;
	generationInfo?: MockGenerationInfo;
}

export interface MockEntity {
	description: string;
	id: string;
	itemCount: number;
	name: string;
}

export interface MockCharacter extends MockEntity {
	ipIds: string[];
}

export interface MockConfig {
	ai: {
		autoAnalyzePrompt: boolean;
		baseUrl: string;
		timeoutMs: number;
	};
	downloads: {
		rateLimitEnabled: boolean;
		requestIntervalMs: number;
	};
	jobs: {
		aiConcurrency: number;
		concurrency: number;
		enableAutoTagging: boolean;
		pollIntervalMs: number;
	};
	logging: {
		enableConsoleMirror: boolean;
		level: "debug" | "info" | "warn";
		retentionDays: number;
	};
	storage: {
		originalDir: string;
		thumbnailDir: string;
		thumbnailSize: number;
	};
}

export const mockSources: MockSource[] = [
	{
		connectionInfo: {
			path: "/mnt/media/generations",
		},
		description: "Stable Diffusion output watched from the workstation.",
		id: "src-local",
		lastSync: "2 minutes ago",
		mediaCount: 18,
		name: "Local Generations",
		status: "active",
		type: "local",
	},
	{
		connectionInfo: {
			host: "192.168.20.18",
			port: 22,
			remotePath: "/srv/reference-board",
			username: "imager",
		},
		description: "Curated references for tagging and project assignment.",
		id: "src-board",
		lastSync: "18 minutes ago",
		mediaCount: 11,
		name: "Reference Board",
		status: "idle",
		type: "sftp",
	},
	{
		connectionInfo: {
			bucket: "solid-imager-imports",
			prefix: "desktop/inbox",
			region: "ap-northeast-1",
		},
		description: "New files dropped by external tools before review.",
		id: "src-inbox",
		lastSync: "yesterday",
		mediaCount: 7,
		name: "Import Inbox",
		status: "error",
		type: "s3",
	},
];

export const mockProjects: MockEntity[] = [
	{
		description: "Urban night scenes collected for search and curation tests.",
		id: "project-starlit",
		itemCount: 12,
		name: "Starlit District",
	},
	{
		description: "Botanical and daylight compositions used for tagging QA.",
		id: "project-orchard",
		itemCount: 8,
		name: "Orchard Atlas",
	},
];

export const mockIps: MockEntity[] = [
	{
		description: "Shared visual language for neon city assets.",
		id: "ip-astral",
		itemCount: 21,
		name: "Astral Blocks",
	},
	{
		description: "Illustrative fantasy reference set.",
		id: "ip-vellum",
		itemCount: 9,
		name: "Vellum Archive",
	},
];

export const mockCharacters: MockCharacter[] = [
	{
		description: "Primary protagonist used in sheet and expression tests.",
		id: "char-rin",
		ipIds: ["ip-astral"],
		itemCount: 6,
		name: "Rin Kisaragi",
	},
	{
		description: "Mechanical support character with alternate loadouts.",
		id: "char-sable",
		ipIds: ["ip-astral", "ip-vellum"],
		itemCount: 4,
		name: "Sable Unit",
	},
];

function associationsFromIds(
	ids: string[],
	items: MockEntity[],
): MockAssociation[] {
	return ids
		.map((id) => items.find((item) => item.id === id))
		.filter((item): item is MockEntity => item !== undefined)
		.map((item) => ({ id: item.id, name: item.name }));
}

const baseAuthors: MockAuthor[] = [
	{ id: "author-nova", name: "nova", accountId: "@nova" },
	{ id: "author-atelier", name: "atelier", accountId: "@atelier" },
	{ id: "author-orbit", name: "orbit", accountId: "@orbit" },
];

export const mockMedia: MockMedia[] = [
	{
		authors: [baseAuthors[0]],
		characters: associationsFromIds(["char-rin"], mockCharacters),
		description:
			"Glass reflections and ambient glow balanced well on this version.",
		favorite: true,
		fileName: "aurora-room.png",
		filePath: "/mnt/media/generations/aurora-room.png",
		fileSize: 4_912_128,
		generationInfo: {
			negativePrompt: "blurry, noisy, distorted furniture",
			prompt:
				"cinematic room interior, glass reflections, teal ambient light, volumetric haze",
			workflow: { cfg: 6.5, sampler: "dpmpp_2m", steps: 28 },
		},
		height: 1024,
		id: "media-aurora-room",
		ips: associationsFromIds(["ip-astral"], mockIps),
		mediaSourceId: "src-local",
		mediaType: "image",
		modifiedAt: "2026-04-09T09:20:00Z",
		negativeTags: [{ name: "distortion", source: "manual", type: "negative" }],
		positiveTags: [
			{ name: "interior", source: "AI", type: "positive" },
			{ name: "lighting", source: "comfyui_workflow", type: "positive" },
			{ name: "teal", source: "manual", type: "positive" },
		],
		projects: associationsFromIds(["project-starlit"], mockProjects),
		prompt:
			"cinematic room interior, glass reflections, teal ambient light, volumetric haze",
		rating: 5,
		resolution: "1536x1024",
		sourceName: "Local Generations",
		status: "tagged",
		summary:
			"Interior render with teal ambient lighting and glass reflections.",
		tags: ["interior", "teal", "lighting"],
		title: "Aurora Room",
		updatedAt: "2026-04-09 09:20",
		urls: [{ url: "https://example.com/aurora-room" }],
		viewCount: 182,
		width: 1536,
	},
	{
		authors: [baseAuthors[0]],
		characters: associationsFromIds(["char-rin"], mockCharacters),
		description: "Pending review for composition and prompt extraction.",
		favorite: false,
		fileName: "rain-alley.png",
		filePath: "/mnt/media/generations/rain-alley.png",
		fileSize: 3_882_921,
		generationInfo: {
			negativePrompt: "washed out colors, crowd clutter",
			prompt:
				"rainy alley, anime city, neon signs, wet asphalt, moody atmosphere",
			workflow: { cfg: 7, sampler: "euler_a", steps: 24 },
		},
		height: 832,
		id: "media-rain-alley",
		ips: associationsFromIds(["ip-astral"], mockIps),
		mediaSourceId: "src-local",
		mediaType: "image",
		modifiedAt: "2026-04-09T08:52:00Z",
		negativeTags: [{ name: "overexposed", source: "AI", type: "negative" }],
		positiveTags: [
			{ name: "city", source: "AI", type: "positive" },
			{ name: "night", source: "AI", type: "positive" },
			{ name: "neon", source: "manual", type: "positive" },
		],
		projects: associationsFromIds(["project-starlit"], mockProjects),
		prompt:
			"rainy alley, anime city, neon signs, wet asphalt, moody atmosphere",
		rating: 4,
		resolution: "1216x832",
		sourceName: "Local Generations",
		status: "review",
		summary: "Street scene with neon signage and reflective asphalt.",
		tags: ["city", "night", "neon"],
		title: "Rain Alley",
		updatedAt: "2026-04-09 08:52",
		urls: [{ url: "https://example.com/rain-alley" }],
		viewCount: 146,
		width: 1216,
	},
	{
		authors: [{ id: "author-flora", name: "flora" }],
		characters: [],
		description: "Useful as a natural texture reference for QA runs.",
		favorite: false,
		fileName: "botanical-study.png",
		filePath: "/mnt/media/generations/botanical-study.png",
		fileSize: 2_951_100,
		generationInfo: {
			prompt:
				"botanical close-up, dewdrops, painterly brushwork, natural study",
			workflow: { cfg: 5.5, sampler: "heun", steps: 20 },
		},
		height: 1024,
		id: "media-botanical-study",
		ips: associationsFromIds(["ip-vellum"], mockIps),
		mediaSourceId: "src-local",
		mediaType: "image",
		modifiedAt: "2026-04-08T21:13:00Z",
		negativeTags: [],
		positiveTags: [
			{ name: "macro", source: "AI", type: "positive" },
			{ name: "nature", source: "manual", type: "positive" },
			{ name: "study", source: "AI", type: "positive" },
		],
		projects: associationsFromIds(["project-orchard"], mockProjects),
		prompt: "botanical close-up, dewdrops, painterly brushwork, natural study",
		rating: 3,
		resolution: "1024x1024",
		sourceName: "Local Generations",
		status: "queued",
		summary: "Macro composition of leaves and dew with painterly texture.",
		tags: ["macro", "nature", "study"],
		title: "Botanical Study",
		updatedAt: "2026-04-08 21:13",
		urls: [{ url: "https://example.com/botanical-study" }],
		viewCount: 39,
		width: 1024,
	},
	{
		authors: [baseAuthors[1]],
		characters: associationsFromIds(["char-rin", "char-sable"], mockCharacters),
		description:
			"Reference sheet with enough structure to validate associations.",
		favorite: true,
		fileName: "hero-sheet.png",
		filePath: "/srv/reference-board/hero-sheet.png",
		fileSize: 6_412_000,
		generationInfo: {
			prompt:
				"hero character sheet, turnaround, costume notes, polished concept art",
			workflow: { renderer: "manual import", source: "reference board" },
		},
		height: 1536,
		id: "media-hero-sheet",
		ips: associationsFromIds(["ip-astral", "ip-vellum"], mockIps),
		mediaSourceId: "src-board",
		mediaType: "image",
		modifiedAt: "2026-04-08T18:31:00Z",
		negativeTags: [],
		positiveTags: [
			{ name: "character", source: "manual", type: "positive" },
			{ name: "sheet", source: "manual", type: "positive" },
			{ name: "reference", source: "manual", type: "positive" },
		],
		projects: associationsFromIds(["project-starlit"], mockProjects),
		prompt:
			"hero character sheet, turnaround, costume notes, polished concept art",
		rating: 5,
		resolution: "2048x1536",
		sourceName: "Reference Board",
		status: "tagged",
		summary: "Character turnaround with costume variations and callouts.",
		tags: ["character", "sheet", "reference"],
		title: "Hero Sheet",
		updatedAt: "2026-04-08 18:31",
		urls: [{ url: "https://example.com/hero-sheet" }],
		viewCount: 221,
		width: 2048,
	},
	{
		authors: [baseAuthors[1]],
		characters: [],
		description: "Collected props used for quick negative tag checks.",
		favorite: false,
		fileName: "prop-board.png",
		filePath: "/srv/reference-board/prop-board.png",
		fileSize: 3_455_008,
		generationInfo: {
			prompt: "prop board, industrial gadgets, reference layout, clean labels",
			workflow: { renderer: "manual import", source: "reference board" },
		},
		height: 1200,
		id: "media-prop-board",
		ips: associationsFromIds(["ip-vellum"], mockIps),
		mediaSourceId: "src-board",
		mediaType: "image",
		modifiedAt: "2026-04-08T14:05:00Z",
		negativeTags: [{ name: "duplicate", source: "manual", type: "negative" }],
		positiveTags: [
			{ name: "props", source: "manual", type: "positive" },
			{ name: "reference", source: "manual", type: "positive" },
			{ name: "batch", source: "AI", type: "positive" },
		],
		projects: associationsFromIds(["project-starlit"], mockProjects),
		prompt: "prop board, industrial gadgets, reference layout, clean labels",
		rating: 4,
		resolution: "1600x1200",
		sourceName: "Reference Board",
		status: "review",
		summary: "Assorted props collected for batch tagging verification.",
		tags: ["props", "reference", "batch"],
		title: "Prop Board",
		updatedAt: "2026-04-08 14:05",
		urls: [{ url: "https://example.com/prop-board" }],
		viewCount: 87,
		width: 1600,
	},
	{
		authors: [baseAuthors[2]],
		characters: [],
		description:
			"Queued import pending metadata cleanup and project assignment.",
		favorite: false,
		fileName: "courtyard-dawn.png",
		filePath: "s3://solid-imager-imports/desktop/inbox/courtyard-dawn.png",
		fileSize: 2_106_448,
		generationInfo: {
			prompt:
				"courtyard at dawn, warm fog, soft architecture, concept matte painting",
			workflow: { source: "external import", notes: "queue pending" },
		},
		height: 768,
		id: "media-courtyard-dawn",
		ips: associationsFromIds(["ip-vellum"], mockIps),
		mediaSourceId: "src-inbox",
		mediaType: "image",
		modifiedAt: "2026-04-08T11:10:00Z",
		negativeTags: [],
		positiveTags: [
			{ name: "environment", source: "AI", type: "positive" },
			{ name: "sunrise", source: "manual", type: "positive" },
			{ name: "courtyard", source: "AI", type: "positive" },
		],
		projects: associationsFromIds(["project-orchard"], mockProjects),
		prompt:
			"courtyard at dawn, warm fog, soft architecture, concept matte painting",
		rating: 2,
		resolution: "1344x768",
		sourceName: "Import Inbox",
		status: "queued",
		summary: "Warm sunrise scene pending first-pass metadata cleanup.",
		tags: ["environment", "sunrise", "courtyard"],
		title: "Courtyard Dawn",
		updatedAt: "2026-04-08 11:10",
		urls: [{ url: "https://example.com/courtyard-dawn" }],
		viewCount: 28,
		width: 1344,
	},
	{
		authors: [baseAuthors[2]],
		characters: associationsFromIds(["char-sable"], mockCharacters),
		description: "Imported tech lab asset used for detail screen validation.",
		favorite: true,
		fileName: "signal-lab.png",
		filePath: "s3://solid-imager-imports/desktop/inbox/signal-lab.png",
		fileSize: 5_003_012,
		generationInfo: {
			negativePrompt: "muddy lighting, unreadable UI",
			prompt:
				"sci-fi laboratory, signal monitors, clean industrial interior, orange light",
			workflow: { cfg: 7.5, sampler: "euler", steps: 30 },
		},
		height: 1024,
		id: "media-signal-lab",
		ips: associationsFromIds(["ip-astral"], mockIps),
		mediaSourceId: "src-inbox",
		mediaType: "image",
		modifiedAt: "2026-04-07T23:44:00Z",
		negativeTags: [{ name: "artifact", source: "AI", type: "negative" }],
		positiveTags: [
			{ name: "lab", source: "AI", type: "positive" },
			{ name: "technology", source: "AI", type: "positive" },
			{ name: "environment", source: "manual", type: "positive" },
		],
		projects: associationsFromIds(["project-starlit"], mockProjects),
		prompt:
			"sci-fi laboratory, signal monitors, clean industrial interior, orange light",
		rating: 4,
		resolution: "1792x1024",
		sourceName: "Import Inbox",
		status: "review",
		summary: "Tech lab environment imported from an external render queue.",
		tags: ["lab", "technology", "environment"],
		title: "Signal Lab",
		updatedAt: "2026-04-07 23:44",
		urls: [{ url: "https://example.com/signal-lab" }],
		viewCount: 113,
		width: 1792,
	},
	{
		authors: [baseAuthors[1]],
		characters: [],
		description: "Mechanical silhouette study used for annotation tests.",
		favorite: true,
		fileName: "mecha-note.png",
		filePath: "/srv/reference-board/mecha-note.png",
		fileSize: 4_220_982,
		generationInfo: {
			prompt:
				"mecha silhouette sheet, annotation arrows, industrial concept sketch",
			workflow: { renderer: "manual import", source: "reference board" },
		},
		height: 1400,
		id: "media-mecha-note",
		ips: associationsFromIds(["ip-astral"], mockIps),
		mediaSourceId: "src-board",
		mediaType: "image",
		modifiedAt: "2026-04-07T20:02:00Z",
		negativeTags: [],
		positiveTags: [
			{ name: "mecha", source: "manual", type: "positive" },
			{ name: "sheet", source: "manual", type: "positive" },
			{ name: "annotation", source: "manual", type: "positive" },
		],
		projects: associationsFromIds(["project-starlit"], mockProjects),
		prompt:
			"mecha silhouette sheet, annotation arrows, industrial concept sketch",
		rating: 5,
		resolution: "1400x1400",
		sourceName: "Reference Board",
		status: "tagged",
		summary: "Annotated mechanical silhouette sheet for quick comparison.",
		tags: ["mecha", "sheet", "annotation"],
		title: "Mecha Note",
		updatedAt: "2026-04-07 20:02",
		urls: [{ url: "https://example.com/mecha-note" }],
		viewCount: 167,
		width: 1400,
	},
];

export const mockConfig: MockConfig = {
	ai: {
		autoAnalyzePrompt: true,
		baseUrl: "http://127.0.0.1:8000",
		timeoutMs: 12000,
	},
	downloads: {
		rateLimitEnabled: true,
		requestIntervalMs: 750,
	},
	jobs: {
		aiConcurrency: 2,
		concurrency: 4,
		enableAutoTagging: true,
		pollIntervalMs: 1500,
	},
	logging: {
		enableConsoleMirror: true,
		level: "info",
		retentionDays: 14,
	},
	storage: {
		originalDir: "/mnt/media/originals",
		thumbnailDir: "/mnt/media/.thumbs",
		thumbnailSize: 640,
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
	return mockMedia.filter((media) => media.mediaSourceId === sourceId);
}
