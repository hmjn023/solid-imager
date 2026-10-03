import { implement, ORPCError } from "@orpc/server";
import { authorsContract } from "@solid-imager/core/domain/contract/authors.contract";
import {
	ResourceConflictError,
	ResourceNotFoundError,
} from "@solid-imager/core/domain/errors";
import { AuthorService } from "~/infrastructure/services/author-service";
import { AuthorAccountVerificationService } from "~/infrastructure/services/author-account-verification-service";

const os = implement(authorsContract);

async function withAuthorErrors<T>(action: () => Promise<T>): Promise<T> {
	try {
		return await action();
	} catch (error) {
		if (error instanceof ResourceConflictError)
			throw new ORPCError("CONFLICT", { message: error.message });
		if (error instanceof ResourceNotFoundError)
			throw new ORPCError("NOT_FOUND", {
				message:
					"対象が見つからないか、確認期限が切れました。一覧を再取得してやり直してください。",
			});
		throw error;
	}
}
export const authorsRouter = os.router({
	beginAccountVerification: os.beginAccountVerification.handler(({ input }) =>
		withAuthorErrors(() => AuthorAccountVerificationService.begin(input)),
	),
	getAccountVerification: os.getAccountVerification.handler(({ input }) =>
		withAuthorErrors(async () =>
			AuthorAccountVerificationService.get(input.verificationId),
		),
	),
	submitAccountVerification: os.submitAccountVerification.handler(({ input }) =>
		withAuthorErrors(async () =>
			AuthorAccountVerificationService.submit(
				input.verificationId,
				input.profile,
			),
		),
	),
	confirmAccountVerification: os.confirmAccountVerification.handler(
		({ input }) =>
			withAuthorErrors(() =>
				AuthorAccountVerificationService.confirm(input.verificationId),
			),
	),
	list: os.list.handler(() => AuthorService.getAllAuthors()),
	create: os.create.handler(({ input }) =>
		withAuthorErrors(() => AuthorService.createAuthor(input)),
	),
	updateName: os.updateName.handler(({ input }) =>
		withAuthorErrors(() =>
			AuthorService.updateAuthor(input.id, { name: input.name }),
		),
	),
	listMedia: os.listMedia.handler(({ input }) =>
		AuthorService.listMedia(input),
	),
	correctMedia: os.correctMedia.handler(async ({ input }) => ({
		changedCount: await withAuthorErrors(() =>
			AuthorService.correctMedia(input),
		),
	})),
	merge: os.merge.handler(async ({ input }) => ({
		changedCount: await withAuthorErrors(() => AuthorService.merge(input)),
	})),
});
