function notImplemented(feature: string): never {
	throw new Error(`${feature} is not implemented`);
}

export const AnalyticsService = {
	getSourceStats(_mediaSourceId: string) {
		return notImplemented("AnalyticsService.getSourceStats");
	},
	getGlobalStats() {
		return notImplemented("AnalyticsService.getGlobalStats");
	},
	getDuplicateMedia(_mediaSourceId: string) {
		return notImplemented("AnalyticsService.getDuplicateMedia");
	},
	getSimilarMedia(_mediaSourceId: string, _mediaPath: string) {
		return notImplemented("AnalyticsService.getSimilarMedia");
	},
	getPopularMedia() {
		return notImplemented("AnalyticsService.getPopularMedia");
	},
};

export const BulkOperationService = {
	bulkEditMedia(_mediaSourceId: string, _mediaIds: string[], _updates: unknown) {
		return notImplemented("BulkOperationService.bulkEditMedia");
	},
	bulkDeleteMedia(_mediaSourceId: string, _mediaIds: string[]) {
		return notImplemented("BulkOperationService.bulkDeleteMedia");
	},
	bulkMoveMedia(_mediaSourceId: string, _mediaIds: string[], _destinationPath: string) {
		return notImplemented("BulkOperationService.bulkMoveMedia");
	},
	bulkTagMedia(
		_mediaSourceId: string,
		_mediaIds: string[],
		_tagsToAdd: number[],
		_tagsToRemove: number[],
	) {
		return notImplemented("BulkOperationService.bulkTagMedia");
	},
};

export const DataMigrationService = {
	exportSource(_mediaSourceId: string, _format: "zip") {
		return notImplemented("DataMigrationService.exportSource");
	},
	importDataIntoSource(_mediaSourceId: string, _importData: unknown) {
		return notImplemented("DataMigrationService.importDataIntoSource");
	},
	scanSource(_mediaSourceId: string) {
		return notImplemented("DataMigrationService.scanSource");
	},
	cloneSource(_mediaSourceId: string, _newName: string) {
		return notImplemented("DataMigrationService.cloneSource");
	},
	downloadMedia(_mediaSourceId: string, _mediaId: string) {
		return notImplemented("DataMigrationService.downloadMedia");
	},
};

export const FilterPresetService = {
	getPresets() {
		return notImplemented("FilterPresetService.getPresets");
	},
	savePreset(_presetData: { name: string; conditions: unknown }) {
		return notImplemented("FilterPresetService.savePreset");
	},
};

export const IntegrationService = {
	uploadToComfyUi(_mediaId: string, _comfyUiUrl: string) {
		return notImplemented("IntegrationService.uploadToComfyUi");
	},
	getComfyUiWorkflows() {
		return notImplemented("IntegrationService.getComfyUiWorkflows");
	},
	sendDiscordNotification(_message: string, _webhookUrl: string) {
		return notImplemented("IntegrationService.sendDiscordNotification");
	},
};

export const WorkflowService = {
	getJobList() {
		return notImplemented("WorkflowService.getJobList");
	},
	cancelJob(_jobId: number) {
		return notImplemented("WorkflowService.cancelJob");
	},
	autoTagMedia(_mediaSourceId: string) {
		return notImplemented("WorkflowService.autoTagMedia");
	},
};
