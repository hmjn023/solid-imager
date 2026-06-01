export { sourcesContract } from "./sources.contract";
export { tagsContract } from "./tags.contract";
export { mediaContract } from "./media.contract";
export { categoriesContract } from "./categories.contract";
export { projectsContract } from "./projects.contract";
export { charactersContract } from "./characters.contract";
export { ipsContract } from "./ips.contract";
export { authorsContract } from "./authors.contract";
export { thumbnailsContract } from "./thumbnails.contract";
export { downloadsContract } from "./downloads.contract";
export { directoriesContract } from "./directories.contract";
export { aiContract } from "./ai.contract";
export { importsContract } from "./imports.contract";
export { utilsContract } from "./utils.contract";
export { configContract } from "./config.contract";
export { presetsContract } from "./presets.contract";

import { sourcesContract } from "./sources.contract";
import { tagsContract } from "./tags.contract";
import { mediaContract } from "./media.contract";
import { categoriesContract } from "./categories.contract";
import { projectsContract } from "./projects.contract";
import { charactersContract } from "./characters.contract";
import { ipsContract } from "./ips.contract";
import { authorsContract } from "./authors.contract";
import { thumbnailsContract } from "./thumbnails.contract";
import { downloadsContract } from "./downloads.contract";
import { directoriesContract } from "./directories.contract";
import { aiContract } from "./ai.contract";
import { importsContract } from "./imports.contract";
import { utilsContract } from "./utils.contract";
import { configContract } from "./config.contract";
import { presetsContract } from "./presets.contract";

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
	utils: utilsContract,
	config: configContract,
	presets: presetsContract,
};

export type AppContract = typeof appContract;
