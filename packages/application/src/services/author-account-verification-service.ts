import type {
	Author,
	AuthorAccountVerification,
	BeginAuthorAccountVerificationInput,
	TwitterProfile,
} from "@solid-imager/core/domain/authors/schemas";
import {
	ResourceConflictError,
	ResourceNotFoundError,
} from "@solid-imager/core/domain/errors";
import type { IAuthorService } from "../ports/author-service";

const LIFETIME_MS = 10 * 60 * 1000;
type Preview = {
	authorId: string;
	accountId: string | null;
	expectedUpdatedAt: Date;
	expectedRemoteId: string | null;
	username: string;
	view: AuthorAccountVerification;
	observedAt: Date | null;
	result: Author | null;
	confirming: Promise<Author> | null;
};
export function createAuthorAccountVerificationState() {
	return new Map<string, Preview>();
}

/** A preview only stages identity evidence. User confirmation is the only write path. */
export function createAuthorAccountVerificationService(
	authors: IAuthorService,
	state = createAuthorAccountVerificationState(),
	now = () => new Date(),
) {
	const prune = () => {
		for (const [id, preview] of state)
			if (preview.view.expiresAt <= now() && !preview.confirming)
				state.delete(id);
	};
	const get = (id: string) => {
		prune();
		const preview = state.get(id);
		if (!preview)
			throw new ResourceNotFoundError("期限切れの確認リクエスト", id);
		return preview;
	};
	return {
		async begin(
			input: BeginAuthorAccountVerificationInput,
		): Promise<AuthorAccountVerification> {
			prune();
			if (state.size >= 200)
				throw new ResourceConflictError(
					"確認リクエストが多すぎます。少し待って再試行してください。",
				);
			const author = await authors.getAuthor(input.authorId);
			const account = author?.accounts?.find(
				(item) => item.id === input.accountId,
			);
			if (!author || (input.accountId && !account))
				throw new ResourceNotFoundError(
					"Author account",
					input.accountId ?? input.authorId,
				);
			if (!input.accountId && author.accounts?.length)
				throw new ResourceConflictError(
					"登録済みのアカウントを選択してください。",
				);
			if (account?.platform && account.platform !== "twitter")
				throw new ResourceConflictError("Xのアカウントを選択してください。");
			const verificationId = crypto.randomUUID();
			const username = input.username.replace(/^@/, "");
			const view: AuthorAccountVerification = {
				verificationId,
				profileUrl: `https://x.com/${username}#solid-imager-account-verification=${verificationId}`,
				expiresAt: new Date(now().getTime() + LIFETIME_MS),
				profile: null,
				confirmed: false,
				error: null,
			};
			state.set(verificationId, {
				authorId: input.authorId,
				accountId: input.accountId,
				expectedUpdatedAt: account?.updatedAt ?? author.updatedAt,
				expectedRemoteId: account?.remoteId ?? null,
				username,
				view,
				observedAt: null,
				result: null,
				confirming: null,
			});
			return { ...view };
		},
		get(id: string): AuthorAccountVerification {
			return { ...get(id).view };
		},
		submit(id: string, profile: TwitterProfile): AuthorAccountVerification {
			const preview = get(id);
			if (profile.username.toLowerCase() !== preview.username.toLowerCase()) {
				preview.view.error =
					"指定したユーザー名と取得結果が一致しません。現在のユーザー名を確認してください。";
				throw new ResourceConflictError(preview.view.error);
			}
			if (
				preview.expectedRemoteId &&
				preview.expectedRemoteId !== profile.remoteId
			) {
				preview.view.error =
					"登録済みの固定IDと異なるアカウントです。作者の付け替え・統合で修正してください。";
				throw new ResourceConflictError(preview.view.error);
			}
			// Freeze the first preview; a result shown to the user must never change underneath confirmation.
			if (preview.view.profile) {
				if (JSON.stringify(preview.view.profile) !== JSON.stringify(profile))
					throw new ResourceConflictError(
						"取得結果が変化しました。再取得して確認してください。",
					);
				return { ...preview.view };
			}
			preview.view.profile = { ...profile };
			preview.view.error = null;
			preview.observedAt = now();
			return { ...preview.view };
		},
		async confirm(id: string): Promise<Author> {
			const preview = get(id);
			if (preview.result) return preview.result;
			if (preview.confirming) return preview.confirming;
			if (!preview.view.profile || !preview.observedAt || preview.view.error)
				throw new ResourceConflictError(
					"プロフィール取得後に確認してください。",
				);
			preview.confirming = authors.confirmAccount({
				authorId: preview.authorId,
				accountId: preview.accountId,
				expectedUpdatedAt: preview.expectedUpdatedAt,
				profile: preview.view.profile,
				observedAt: preview.observedAt,
			});
			try {
				preview.result = await preview.confirming;
				preview.view.confirmed = true;
				return preview.result;
			} finally {
				preview.confirming = null;
			}
		},
	};
}
