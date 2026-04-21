export type NewProcessMediaJob = {
	type: "processMedia";
	mediaSourceId: string;
	payload: unknown;
};

export type ProcessMediaJobRepository = {
	create(job: NewProcessMediaJob): Promise<unknown>;
};
