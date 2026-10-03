/** OpenAPI tag descriptions used when generating the API specification. */
export const openApiTags = [
	{
		name: "Media Sources",
		description:
			"ローカル、SFTP、S3などのメディアソースの登録、設定、同期、エクスポート、インポートを行います。",
	},
	{
		name: "Media",
		description:
			"メディアの検索、詳細取得、アップロード、編集、削除、および一括操作を行います。",
	},
	{
		name: "Search Snapshots",
		description:
			"ブラウザ履歴から検索状態を復元するためのスナップショットを保存、取得します。",
	},
	{
		name: "Tags",
		description:
			"タグの一覧取得、作成、編集、削除を行います。メディアとの関連付けはMedia操作から行います。",
	},
	{
		name: "Categories",
		description: "メディアのカテゴリを作成、編集、削除します。",
	},
	{
		name: "Projects",
		description: "プロジェクトを管理し、メディアとの関連付けを行います。",
	},
	{
		name: "Characters",
		description: "キャラクターを管理し、メディアとの関連付けを行います。",
	},
	{
		name: "IPs",
		description:
			"作品やシリーズなどのIPを管理し、メディアとの関連付けを行います。",
	},
	{
		name: "Thumbnails",
		description: "メディアのサムネイル生成とキャッシュ削除を行います。",
	},
	{
		name: "Downloads",
		description:
			"外部からのメディアダウンロードをバックグラウンドジョブとして開始します。",
	},
	{
		name: "Directories",
		description:
			"メディアソース内のディレクトリ一覧取得、作成、削除、名前変更を行います。",
	},
	{
		name: "AI",
		description: "画像のAIタグ付け、特徴量抽出、類似検索、一括解析を行います。",
	},
	{
		name: "Utilities",
		description:
			"URLの内容取得など、アプリケーション共通の補助操作を提供します。",
	},
	{
		name: "Authors",
		description: "メディアから抽出された作者情報を取得します。",
	},
	{
		name: "Configuration",
		description: "アプリケーション設定を取得、更新します。",
	},
	{
		name: "Imports",
		description:
			"インポート待ち項目の登録、処理、キャンセルと進捗購読を行います。",
	},
	{
		name: "Jobs",
		description:
			"バックグラウンドジョブの一覧、状態確認、再実行、キャンセル、成果物取得を行います。",
	},
	{
		name: "Presets",
		description: "検索条件を保存したプリセットを作成、取得、更新、削除します。",
	},
];
