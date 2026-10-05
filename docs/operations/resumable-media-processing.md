# メディア取り込みの復旧と移行

## 対象

#771 の最初の実装として、`processMedia` にメタデータ抽出・サムネイル生成・AIジョブ予約の工程別チェックポイントを追加する。アップロード、`registerAndProcess`（監視／インポート経由）、既存ディレクトリ登録では、メディア行・関連情報・処理ジョブを同じDBトランザクションで保存する。

工程に失敗しても独立した残りの工程は実行する。1工程でも失敗したジョブは `failed` になり、Jobs の詳細に各工程の状態を表示する。原因を解消して **Retry job** を押すと、同じジョブの失敗・未完了工程のみを再実行する。AI予約の完了は推論完了を意味せず、推論結果は別のAIジョブで確認する。

中断された `in_progress` ジョブは既存workerのstale recoveryによって再キューされる。DB上のチェックポイントは保持され、再claimでattemptが増える。古いattemptやキャンセル済みattemptは、工程結果の保存・サムネイルの公開・heartbeat更新を拒否される。起動時の補修は同じメディアの未完了／失敗ジョブが担当している工程を再予約しない。失敗ジョブは利用者の明示的なRetryを待つ。

## migration 0032

以前のmigrationで `jobs` は `UNLOGGED` になっている。異常終了時にキューとチェックポイントが消えないよう、0032で **LOGGED** に戻し、nullableな `processing_checkpoint` と補修検索用の部分indexを追加する。既存のジョブを削除・統合しない。チェックポイントのない既存ジョブは初回実行時に初期化する。

`SET LOGGED` はテーブルを書き換え、強いロックとWAL／追加ディスク容量を必要とする。本番適用前に同程度の件数の復元DBで所要時間と空き容量を確認する。

1. API、worker、ファイル監視など、ジョブとメディアを書き込む全プロセスを停止する。通常のComposeでは `app` にworkerが同居している。旧版workerを新版と混在させない。
2. DB、設定、メディア実体、サムネイル／ジョブ用ファイルをバックアップし、復元できることを確認する。
3. 対象環境の設定で `bun run --cwd apps/server db:migrate` を実行する。PGliteでは `bun run --cwd apps/server db:migrate:pglite` を使用する。
4. 下記SQLで通常テーブル（`p`）と新しい列を確認し、新版のプロセスを起動する。
5. テスト用画像を登録し、Jobsの工程表示、完了、失敗後のRetryを確認する。

```sql
SELECT relpersistence FROM pg_class WHERE oid = 'jobs'::regclass;
SELECT column_name FROM information_schema.columns
WHERE table_name = 'jobs' AND column_name = 'processing_checkpoint';
```

ロック獲得には5秒の `lock_timeout` を設定している。タイムアウト時はmigrationのトランザクションがロールバックされるため、書き込み元と長時間トランザクションを確認して再実行する。テーブル書き換えの所要時間が5秒に制限されるわけではない。

問題があれば書き込み元を停止して調査する。緊急に旧版アプリへ戻す場合もLOGGEDと追加列は維持できるが、旧workerはチェックポイントを扱えず工程を再実行する。データごと巻き戻す場合は停止状態で移行前のDB・ファイルの組を復元する。復旧目的で `SET UNLOGGED` に戻さない。

## 保証の範囲と残作業

- チェックポイントは今回のジョブの実行記録。#620 のメディア単位processing-state、#621 のrun/itemsへの移行ではない。
- 入力revisionはメディアID、ソースID／パス、相対パス、DBに記録された更新日時・サイズから作る。Retry時に変化していれば全工程を再初期化する。内容ハッシュ、processor/model version、監視が検出していないファイル変更は対象外。
- 生成は一時ファイルで行い、現在のattemptとメディアrevisionを確認してからrenameする。DBとファイルシステムは単一トランザクションにならない。公開直後・DB commit直前の停止では同じ工程を再実行する。クラッシュで残った `*.tmp.webp` はworker停止中に除去可能。
- アップロードのファイル保存自体はDB commitの前に行う。DB失敗時、新規ファイルは削除を試みるが、上書きアップロードの元データ復元や、コピー／移動／downloadの全経路の原子化は含まない。
- 同一ジョブの再試行ではAI予約を重複させない。別ジョブ間の全ジョブ種別dedup、既存重複行の統合、ドメイン出力全体のfencingは #619 / #620 に残る。起動時の補修予約同士はメディア行ロックで直列化する。
- 画面には工程種別・状態・試行回数・更新時刻のみを返す。入力revision、payload、ローカルパス、例外詳細は公開しない。例外の詳細はサーバーログのjobId／stepで調べる。

## 回帰検証

```bash
bun run check
bun run test
bun run --cwd apps/server test:e2e -- processing-recovery.spec.ts realtime-preservation.spec.ts --project=desktop
```

`processing-recovery.test.ts` は専用の一時PGliteを使用し、登録のロールバック、工程別Retry、DB再オープン後の復旧、古いattemptとキャンセルの拒否、revision変更、起動時補修の重複抑止を検証する。E2Eは実際のfailedジョブをseedし、開発版・本番ビルドで直接アクセス／F5／SPA遷移と実workerのRetryを検証する。既存のSSE再接続テストも併せて実行する。
