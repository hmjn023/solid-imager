import type { IImageProcessor } from "@solid-imager/core/domain/services/image-processor";
import { initializeTauriDb, type TauriDb } from "./infrastructure/db/client";
import {
	createTauriCommandClient,
	type TauriCommandClient,
} from "./infrastructure/tauri/command-client";
import { TauriFileSystem } from "./infrastructure/tauri/file-system";
import { TauriImageProcessor } from "./infrastructure/tauri/image-processor";

// 各種サービスをインポート
import { TauriAiService } from "./infrastructure/local-api/services/ai-service";
import { TauriAuthorService } from "./infrastructure/local-api/services/author-service";
import { TauriCategoryService } from "./infrastructure/local-api/services/category-service";
import { TauriCharacterService } from "./infrastructure/local-api/services/character-service";
import { TauriCollectionService } from "./infrastructure/local-api/services/collection-service";
import { TauriConfigService } from "./infrastructure/local-api/services/config-service";
import { TauriIpService } from "./infrastructure/local-api/services/ip-service";
import { TauriMediaService } from "./infrastructure/local-api/services/media-service";
import { TauriPresetService } from "./infrastructure/local-api/services/preset-service";
import { TauriProjectService } from "./infrastructure/local-api/services/project-service";
import { TauriSourceBackupService } from "./infrastructure/local-api/services/source-backup-service";
import { TauriSourceService } from "./infrastructure/local-api/services/source-service";
import { TauriTagService } from "./infrastructure/local-api/services/tag-service";
import { TauriUserService } from "./infrastructure/local-api/services/user-service";

export type TauriAppServices = {
	commandClient: TauriCommandClient;
	fileSystem: TauriFileSystem;
	imageProcessor: IImageProcessor;
	db: TauriDb;
	localDatabaseAvailable: boolean;

	aiService: typeof TauriAiService;
	authorService: typeof TauriAuthorService;
	categoryService: typeof TauriCategoryService;
	characterService: typeof TauriCharacterService;
	collectionService: typeof TauriCollectionService;
	configService: typeof TauriConfigService;
	ipService: typeof TauriIpService;
	mediaService: typeof TauriMediaService;
	presetService: typeof TauriPresetService;
	projectService: typeof TauriProjectService;
	sourceBackupService: typeof TauriSourceBackupService;
	sourceService: typeof TauriSourceService;
	tagService: typeof TauriTagService;
	userService: typeof TauriUserService;
};

export type InitializeTauriAppOptions = {
	onStatus?: (message: string) => void;
};

export async function initializeTauriApp(
	options: InitializeTauriAppOptions = {},
): Promise<TauriAppServices> {
	if (typeof document === "undefined") {
		throw new Error("initializeTauriApp must be called in the browser.");
	}

	document.documentElement.dataset.platform = "tauri";

	options.onStatus?.("Connecting to the Tauri runtime...");
	const commandClient = createTauriCommandClient();
	const fileSystem = new TauriFileSystem(commandClient);
	const imageProcessor = new TauriImageProcessor(commandClient);
	const db = await initializeTauriDb({
		onStatus: options.onStatus,
	});

	return {
		commandClient,
		fileSystem,
		imageProcessor,
		db,
		localDatabaseAvailable: true,

		aiService: TauriAiService,
		authorService: TauriAuthorService,
		categoryService: TauriCategoryService,
		characterService: TauriCharacterService,
		collectionService: TauriCollectionService,
		configService: TauriConfigService,
		ipService: TauriIpService,
		mediaService: TauriMediaService,
		presetService: TauriPresetService,
		projectService: TauriProjectService,
		sourceBackupService: TauriSourceBackupService,
		sourceService: TauriSourceService,
		tagService: TauriTagService,
		userService: TauriUserService,
	};
}
