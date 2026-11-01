import type {
	Author,
	AuthorMediaPage,
	NewAuthor,
	AuthorMediaListInput,
	CorrectMediaAuthorsInput,
	MergeAuthorsInput,
	BeginAuthorAccountVerificationInput,
	AuthorAccountVerification,
} from "@solid-imager/core/domain/authors/schemas";

export type AuthorManagementActions = {
	openAccountVerificationProfile?: (url: string) => Promise<void>;
	beginAccountVerification: (
		input: BeginAuthorAccountVerificationInput,
	) => Promise<AuthorAccountVerification>;
	getAccountVerification: (input: {
		verificationId: string;
	}) => Promise<AuthorAccountVerification>;
	confirmAccountVerification: (input: {
		verificationId: string;
	}) => Promise<Author>;
	list: () => Promise<Author[]>;
	create: (input: NewAuthor) => Promise<Author>;
	updateName: (input: { id: string; name: string }) => Promise<Author>;
	listMedia: (input: AuthorMediaListInput) => Promise<AuthorMediaPage>;
	correctMedia: (
		input: CorrectMediaAuthorsInput,
	) => Promise<{ changedCount: number }>;
	merge: (input: MergeAuthorsInput) => Promise<{ changedCount: number }>;
	thumbnailUrl: (sourceId: string, mediaId: string) => string | Promise<string>;
	releaseThumbnailUrl?: (url: string) => void;
};
