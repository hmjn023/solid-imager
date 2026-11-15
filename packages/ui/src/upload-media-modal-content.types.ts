export type UploadMediaModalContentProps = {
	isOpen: boolean;
	reserveUploads?: (files: string[]) => Promise<string[]>;
	onClose: () => void;
	onUpload: (options: {
		file: File;
		reservationId?: string;
		filename: string;
		description: string;
		sourceUrl?: string;
		overwrite: boolean;
		autoIncrement: boolean;
	}) => Promise<void>;
	initialFile: File | null;
	pastedUrl: string | null;
	onFetchUrl: (url: string) => Promise<File>;
};
