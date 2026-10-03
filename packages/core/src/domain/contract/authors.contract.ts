import { oc } from "@orpc/contract";
import {
	authorSchema,
	newAuthorSchema,
	authorMediaListInputSchema,
	authorMediaPageSchema,
	correctMediaAuthorsSchema,
	mergeAuthorsSchema,
	updateAuthorNameSchema,
	authorChangeResultSchema,
	beginAuthorAccountVerificationSchema,
	authorAccountVerificationIdSchema,
	submitAuthorAccountVerificationSchema,
	authorAccountVerificationSchema,
} from "../authors/schemas";

const authorProcedure = oc.errors({
	CONFLICT: {
		message: "作者情報に競合があります。確認して一覧を再取得してください。",
	},
	NOT_FOUND: { message: "対象の作者が見つかりません。" },
});

export const authorsContract = {
	beginAccountVerification: authorProcedure
		.route({
			tags: ["Authors"],
			summary: "現在のXユーザー名でプロフィール確認を開始",
		})
		.input(beginAuthorAccountVerificationSchema)
		.output(authorAccountVerificationSchema),
	getAccountVerification: authorProcedure
		.route({ tags: ["Authors"], summary: "Xプロフィールの取得結果を確認" })
		.input(authorAccountVerificationIdSchema)
		.output(authorAccountVerificationSchema),
	submitAccountVerification: authorProcedure
		.route({
			tags: ["Authors"],
			summary: "xtracterからプロフィール確認結果を送信",
			description: "取得結果を仮保存します。作者情報は変更しません。",
		})
		.input(submitAuthorAccountVerificationSchema)
		.output(authorAccountVerificationSchema),
	confirmAccountVerification: authorProcedure
		.route({
			tags: ["Authors"],
			summary: "同じアカウントと手動確認して固定IDを登録",
			description:
				"確認開始時のアカウントが変更されていないことを検証し、以降の取り込みを固定IDで照合します。",
		})
		.input(authorAccountVerificationIdSchema)
		.output(authorSchema),
	list: authorProcedure
		.route({
			tags: ["Authors"],
			summary: "作者一覧取得",
			description: "外部アカウントを含む作者一覧を取得します。",
		})
		.output(authorSchema.array()),
	create: authorProcedure
		.route({ tags: ["Authors"], summary: "作者登録" })
		.input(newAuthorSchema)
		.output(authorSchema),
	updateName: authorProcedure
		.route({ tags: ["Authors"], summary: "作者の管理名を更新" })
		.input(updateAuthorNameSchema)
		.output(authorSchema),
	listMedia: authorProcedure
		.route({ tags: ["Authors"], summary: "作者に紐づくメディアを確認" })
		.input(authorMediaListInputSchema)
		.output(authorMediaPageSchema),
	correctMedia: authorProcedure
		.route({
			tags: ["Authors"],
			summary: "選択したメディアの作者を修正",
			description: "指定した作者だけを付け替え、他の作者は維持します。",
		})
		.input(correctMediaAuthorsSchema)
		.output(authorChangeResultSchema),
	merge: authorProcedure
		.route({
			tags: ["Authors"],
			summary: "同一人物と確認した作者を統合",
			description:
				"元作者の全メディア・外部アカウント・タグを移して元作者を削除します。",
		})
		.input(mergeAuthorsSchema)
		.output(authorChangeResultSchema),
};
