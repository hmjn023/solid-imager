export type {
	Author,
	AuthorPlatform,
	AuthorAccount,
	AuthorAccountInput,
	AuthorAccountVerification,
	AuthorMediaListInput,
	AuthorMediaPage,
	BeginAuthorAccountVerificationInput,
	ConfirmAuthorAccountInput,
	CorrectMediaAuthorsInput,
	MergeAuthorsInput,
	NewAuthor,
	TwitterProfile,
} from "../domain/authors/schemas";
export {
	authorAccountVerificationSchema,
	authorSchema,
	submitAuthorAccountVerificationSchema,
} from "../domain/authors/schemas";
export type { IAuthorRepository } from "../domain/repositories/author-repository";
