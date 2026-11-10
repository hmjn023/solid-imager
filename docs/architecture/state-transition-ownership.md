# 状態遷移の所有責務 (#855)

受付、実行、観測、画面の編集状態をそれぞれの所有者が確定する。操作開始時に対象を固定し、遅着応答は要求IDまたは世代で照合する。永続化を伴う確定通知はDB commit後に発行し、通知の失敗で保存済みの結果を変更しない。

## 修正対象と所有者

| Issue | 所有者 | 固定する対象・確定点 | 失敗・再送時の扱い |
| --- | --- | --- | --- |
| #856 | `import-queue-service` | pending受付を種別とIDで行lockし、download投入とsubmitted受付を同じTxで確定 | 受付由来の安定UUIDで二重投入を防止。取消はpending受付のみ。失敗はTx全体をrollback |
| #857 | `manager-duplicates-state` | source、scan世代、保持選択、削除確認を同じsnapshotへ束縛 | 範囲変更・再scan・選択変更で確認失効。遅着scanは破棄。削除commandを一度だけ消費 |
| #858 | `bulk-action-command` / `bulk-operation-service` | 確定時に操作、全source群のID、宛先source/pathを固定 | 項目別の成功だけ選択解除。失敗・未処理だけ同じcommandで再試行。通信断や補償失敗による不明な結果は自動再送しない |
| #859 | xtracter background connection settings / destination resolver | 一つの設定snapshotからURL、client、source、世代を確定 | 再試行にも同じclientを使う。source選択はサーバー別。取得失敗を空一覧や古いIDへ変換しない |
| #860 | JobRepository `finishAttempt` | id/status/attempt CASを条件に、取消要求とprocessor結果を単一UPDATEで終端確定 | 旧試行は更新不可。取消要求イベントは非終端。workerは確定した終端のみ配信 |
| #861 | JobRepository batch operations | parent+dispatchを同一Txで作成。集計は子の寄与差分と試行で保護 | 親はclaim対象外。親・子の汎用Retryを拒否。失敗対象は新しいbatchとして開始し、過去の集約を維持 |
| #862 | DirectorySyncService | sourceごとの件数と成否を返し、DB保存後にメモリ状態・イベントを更新 | 不可視パス・部分失敗・保存失敗をRPC/UIでも失敗として表示。同一sourceの並行同期を共有 |
| #863 | FileWatcherManager | 同期待ちの前からsourceごとの開始世代を所有し、ハンドル解放・登録を直列化 | stop/deleteで準備中startも失効。失敗したcloseは再試行できるよう保持。旧callbackは実行しない |
| #864 | Tauri connection/runtime settings | 候補を完全検証し、新DB準備・設定保存・旧DB解放を調整 | 各失敗境界で稼働中参照を復旧。成功時は旧collectionsを破棄。旧cache削除は確定後の後処理 |
| #865 | upload dialog draft | 開いた下書きが選択全体、preview、URL取得世代を所有 | 破棄・選び直し・再openで旧取得を失効。親への通知を初期入力として戻さない |
| #866 | AuthorAccountVerificationService / content delivery | 最初に採用した証拠を固定し、DB確認を共有するPromiseで確定 | 後着不一致は表示を変更せず要求元へ拒否。配送はsuccess:trueでのみ確定し、失敗時に再試行可能 |
| #867 | shared search execution selection | 検索方式と適用条件から表示・query・cache keyを導出 | source内類似検索はsource IDをAPIへ渡す。退避した通常条件は適用中の表示から区別する |
| #868 | `manager-batch-state` | request ID別の開始、job ID別の観測、利用者が選んだ追跡対象を所有 | 開始応答順で追跡を変更しない。GETをSSE世代で保護。scan表示を過去runの終端から分離 |

## ジョブの確定と観測

`pending -> in_progress -> completed | failed | cancelled` をworkerの実行試行として扱う。

- pendingの取消はその場でcancelledへ確定する。
- in_progressの取消は `cancelRequestedAt` を保存し、`job-cancellation-requested` を発行する。この通知だけで追跡を終えない。
- `finishAttempt` が現在の試行をCASで更新する時に取消が保存されていれば、成功・失敗の提案より取消を優先して終端化する。
- `job-completed` / `job-failed` / `job-cancelled` は保存済み状態の通知。通知例外はログに残し、DB結果を再変更しない。
- 親の成功・失敗集約は、全子/dispatchが終端で既知の対象数が揃った後にCASで確定する。最後の子と親の終端を同じTxで保存し、兄弟の同時終了は親の行lockで直列化する。dispatchや不正payloadの失敗は親を非終端で残さない。
- 子の寄与はpayloadの `batchOutcome` に保持し、同一試行の重複通知では差分0とする。従来のresult側 `parentProcessed` / `parentFailed` も読み、更新をまたぐ中断からの二重加算を避ける。古い複数項目chunkのBooleanマーカーは寄与数を確定できないため、推測で加算せず親を明示的に失敗させ、新batchを必要とする。
- 汎用Retryの可否はcoreの `canRetryJob` をAPIとJobs画面で共有する。バッチの過去の集約をpendingへ戻す操作は提供しない。

SSEは更新通知であり、再接続・F5ではAPI snapshotから復元する。ManagerはGET開始時の観測versionを記録し、途中にSSEが届いたGET結果を現在値へ上書きしない。

## #799との重複整理

調査日: 2026-11-10。今回の共通baseは `develop@a63baa36`。GitHubのPR #799はmergedだが、そのmerge `ebb42062` は確認時点のorigin/developとorigin/main (`85f5d20f`) の祖先に含まれない。現行treeには専用import/download/batch/source runのrepositoryおよび汎用runtime撤去の運用文書が存在しない。PRやIssueコメントの「実装完了」を現行ブランチへの適用済みと同一視しない。

#799の設計から今回適用する責務は、受付と投入の原子性、受付由来の冪等性、現在試行のfencing、親非claim、parent/dispatch作成の原子性、DB確定後の通知である。これらを現行jobsと既存APIに適用する。

専用table/runモデル、lease/backoffの全面刷新、cutover authority、汎用jobs廃止、本番観測・rollback gateは #619/#621/#771 側で追跡する。今回の修正をそれらの完了条件には数えない。ソース同期の今回の対象はディレクトリ同期結果の整合性と監視開始の失効である。

関連する #649 の管理画面骨子、#773 の検索/ワークスペース再設計、#843 の検索session保存形式は既存の境界を維持する。

## 回帰検証

- `job-state-persistence.test.ts`: 実Imports/Jobs APIとrepositoryを用い、PGliteのmigration済みDBと専用PostgreSQLの複数接続で二重承認、取消競合、混在ID、rollback、旧試行、親非claim/原子的作成、旧集計マーカー、Retry拒否を検証する。
- Manager: request/scan/観測の単体テストと `manager-state.spec.ts`、既存のManager進捗・再接続・F5のE2E。
- 同期/監視: 実サービスと待機可能な依存を使う競合テスト、RPC/UI outcome、既存のstartup recovery。
- xtracter: 実background listenerへ設定変更と応答遅延を挿入し、URL/source/retryの一貫性と配送の再試行を検証する。
- 一括操作: 実ファイルを含む部分成功・DB/通知失敗・補償と、不変commandからの再試行/残存選択を検証する。
- Tauri: 設定検証、DB準備/close、store保存、cache削除、collection破棄の各境界を検証する。
- アップロード/検索: 遅着取得、複数ファイル、source切替と類似検索のquery/key/表示の一致を検証する。

全体のcheck/test、OpenAPI生成、開発版とfresh productionのブラウザ検証を統合ブランチで実行する。詳細な実行結果はPRに記録する。
