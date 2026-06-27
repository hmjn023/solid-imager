export { aiContract } from "./ai.contract";
export { authorsContract } from "./authors.contract";
export { categoriesContract } from "./categories.contract";
export { charactersContract } from "./characters.contract";
export { configContract } from "./config.contract";
export { directoriesContract } from "./directories.contract";
export { downloadsContract } from "./downloads.contract";
export { importsContract } from "./imports.contract";
export { ipsContract } from "./ips.contract";
export { jobsContract } from "./jobs.contract";
export { mediaContract } from "./media.contract";
export { presetsContract } from "./presets.contract";
export { projectsContract } from "./projects.contract";
export { sourcesContract } from "./sources.contract";
export { tagsContract } from "./tags.contract";
export { thumbnailsContract } from "./thumbnails.contract";
export { utilsContract } from "./utils.contract";

import { aiContract } from "./ai.contract";
import { authorsContract } from "./authors.contract";
import { categoriesContract } from "./categories.contract";
import { charactersContract } from "./characters.contract";
import { configContract } from "./config.contract";
import { directoriesContract } from "./directories.contract";
import { downloadsContract } from "./downloads.contract";
import { importsContract } from "./imports.contract";
import { ipsContract } from "./ips.contract";
import { jobsContract } from "./jobs.contract";
import { mediaContract } from "./media.contract";
import { presetsContract } from "./presets.contract";
import { projectsContract } from "./projects.contract";
import { sourcesContract } from "./sources.contract";
import { tagsContract } from "./tags.contract";
import { thumbnailsContract } from "./thumbnails.contract";
import { utilsContract } from "./utils.contract";

/**
 * API Contract Definition
 * フロントエンド（Tauriアプリ、ブラウザ拡張等）とバックエンドで共有される型定義
 */
export const appContract = {
	sources: sourcesContract,
	tags: tagsContract,
	media: mediaContract,
	categories: categoriesContract,
	projects: projectsContract,
	characters: charactersContract,
	ips: ipsContract,
	authors: authorsContract,
	thumbnails: thumbnailsContract,
	downloads: downloadsContract,
	directories: directoriesContract,
	ai: aiContract,
	imports: importsContract,
	jobs: jobsContract,
	utils: utilsContract,
	config: configContract,
	presets: presetsContract,
};

export type AppContract = typeof appContract;
