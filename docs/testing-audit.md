# テスト棚卸し

今回の対象は、テストの検出力、実行対象の漏れ、E2Eの重複実行と起動コスト。テストが落ちること自体は削除理由にしない。実装に触れない成功確認を除去し、ブラウザーが必要な回帰検証を残した。

## 判断基準

| 判断 | 基準 |
| --- | --- |
| 残す | 実装を呼び、利用者に影響する失敗を検出する。ブラウザー固有の表示、操作、履歴、フォーカス、再接続はブラウザーで検証する |
| 集約する | 同じ入力規則、画面幅に依存しない処理、同じfixtureを繰り返している |
| 強化する | 出力の存在だけを見ており、壊れた内容でも通る |
| 削除する | 定数の自己比較、手作りのレスポンスの自己比較、コメントだけのテスト、完了した移行のディレクトリ存在確認 |
| 調査を続ける | 実際に失敗している、古い画面操作を参照する、外部条件で揺れる。通すためにassertionを弱めない |

## 2026-09-23 の数量と実行対象

Playwrightの `--list --reporter=json` による収集数。成功数やカバレッジ率ではない。

| 対象 | 棚卸し前 | 棚卸し後（両モード全件） |
| --- | ---: | ---: |
| アプリE2E（1モード、旧構成はgalleryを含む） | 165 | 97 |
| アプリdev + production | 330 | 194 |
| 独立したコンポーネント検証 | 上記に7件×2回を内包 | 7件×1回 |
| ブラウザー検証の合計 | 330 | 201 |
| 重複プロジェクトを除いたシナリオ数 | 69 | 69 |

収集数は129件（39%）減。旧構成には実行時skipが1モード19件含まれるため、実際に本体を実行する予定数は292件から201件へ減る。これを実時間の39%短縮とは扱わない。変更前は起動障害で完走できなかったため、全体時間の前後比較はできない。

### 通常テスト

| 対象 | 最終実行ファイル数 | 成功ケース数 |
| --- | ---: | ---: |
| server unit | 37 | 166 |
| server integration | 19 | 68 |
| CLI | 2 | 11 |
| ブラウザー拡張 | 2 | 12 |
| core | 3 | 23 |
| UI | 23 | 117 |
| client | 2 | 6 |
| DB repository | 1 | 8 |
| 合計 | 89 | 411 |

rootの `test` scriptとVitest projectsにclient・DBを追加した。以前はそれぞれのpackageでしか実行できなかった14ケースを通常ゲートに含めた。server unit/integrationには異なるproject名を付け、rootのVitest収集時に同じpackage名で衝突する問題も修正した。

## 削除・移動したテスト

| 旧ファイル | 問題 | 処置・残る検証 |
| --- | --- | --- |
| `packages/ui/src/dummy.test.ts` | `expect(true).toBe(true)` の1件 | 削除。他のUIの状態・選択・query・event testsを維持 |
| `integration/db/pglite-parity.test.ts` | DB接続を3回作成するが、3件とも `expect(true)`。PostgreSQLへの接続も比較も行わない | 削除。**ディスク再接続後の永続性・PostgreSQLとのparityは未検証**として残す |
| `api/tags/index.test.ts`, `api/categories/index.test.ts` | 12件とも空配列や手作り結果の確認、またはコメントのみ | 削除。**これらのAPIのCRUD・not-found・validation・cascadeを検証済みとは扱わない** |
| `api/{tags,characters,categories,ips}/*-test.ts` | 36件が同様の雛形。さらに `*.test.ts` の収集対象からも外れる | 削除。APIの不足ケースは上記と同じ扱い |
| `monorepo-migration.test.ts` | 完了した移行のディレクトリ存在確認3件。通常のunit/integration収集対象外 | 削除。構造・依存関係はtypecheckや実際のpackageテストで検証 |
| `api/media/{add,get,list,delete,update}-media.test.ts` | 20件中10件はCRUDを呼ばず手作り結果を検証する。残る入力schema検証にも重複あり | 5ファイルを削除。入力検証をcoreの `media-input-validation.test.ts` 9件に集約。CRUDは既存 `integration/media/` の実装・DBを使う検証を維持 |

除去した雛形・自己比較は計65ケース（うち39件はもともと通常実行の対象外）。入力schemaを実際に呼ぶ部分は捨てずに移した。スキーマテストはAPIのルーティングやレスポンスを保証するものではない。

## ブラウザーテストの棚卸し

件数は旧構成1モードと新構成1モードの収集数。galleryは変更後に独立して1回だけ実行する。

| spec | 旧→新 | 検出する回帰・対応 |
| --- | ---: | --- |
| `app-nav.responsive` | 4→4 | メニュー、現在位置、フォーカス、コントラスト、overflow。画面幅別の検証を維持 |
| `ccip-flow` | 1→1 | 実推論、完了状態、Find Similar、保留中のF5。native AIを維持 |
| `interface-interactions.responsive` | 40→19 | modifier選択、clipboard、ショートカットはdesktopに限定。modal・zoom等の操作は幅別に維持 |
| `loading-recovery` | 11→11 | 初期pending、背景更新中の結果・未送信入力保持、再試行、ネットワーク各障害。offlineは実通信断と復帰後の検索完了まで強化 |
| `media-detail-manager-config.responsive` | 20→14 | 2枚目への遷移を画像pixelで確認する検証、画面幅別の可用性を維持。保存URL・履歴stackはdesktopに集約 |
| `realtime-preservation` | 1→1 | SSE再接続後に実source eventで内容更新し、dialog・入力・focusを保持。維持 |
| `route-reload` | 7→8 | 各routeの直接URL/F5、SSR HTML、hydration、query数。Jobs/Aboutを追加。操作せず見出しだけ見る「interactive」ケースは削除 |
| `routes.responsive` | 32→13 | 各幅のroute表示・overflowを維持し、F5の繰り返しを `route-reload` に集約。2枚目表示の弱い重複をpixel検証へ集約。固定viewport・exportはdesktop限定 |
| `scroll-restoration` | 4→4 | 戻る経路×collectionで復元中のscroller消失・ページ追加時の位置飛びを検出。galleryの仮想grid検証とは境界が異なるため維持 |
| `search-history` | 2→2 | detail往復、送信直後の検索状態保存。UI・session・ルーターをまたぐため維持 |
| `search-pro-dialog.responsive` | 4→1 | 入力中のfocus保持。desktop専用を収集時に選択 |
| `search-realtime-preservation.responsive` | 8→4 | mobileの検索入力・focusをSSE更新中も保持。mobileだけを収集 |
| `search.responsive` | 4→4 | filterの適用・再表示・条件解除、狭い画面のoverflow、末尾入力とfooterへの到達性。現行の共有検索状態に合わせて検証 |
| `sources-source-media.responsive` | 16→7 | redirect・context menuをdesktopに集約。touch選択、dialog、file chooserは画面幅別に維持 |
| `tauri-migration` | 4→4 | Tauri用SPAのshared画面、preview/detail、source/import dialog。Webとは別entryを通るため維持。native desktop自体の検証ではない |
| `ui-components.gallery` | 7→独立7 | keyboard/overlay、仮想grid、深いscroll、DPR画像選択、画像比較。DB/AI/app serverを起動せず実行 |

### 今回強化した検証

- ManagerのNDJSON/TAR exportは拡張子だけでなく、ダウンロードの完了・エラーなし・metadata内のseeded media 2件を確認する。TARは「Include original media」を選択し、格納された原画像のbytesもfixtureと比較する。
- sidebarの間隔チェックはlinkがなくても `Math.min(...[]) === Infinity` で通ってしまうため、測定対象が存在することも確認する。
- 共通browser healthは、独自の日本語error画面に加えて、実際に観測したTanStack標準の `Something went wrong!` も失敗として扱う。
- galleryにも同じbrowser healthを適用し、console/page/networkの異常を見落とさない。
- offlineはsynthetic eventから `BrowserContext.setOffline` に変更。既存結果を保持したまま検索を送り、復帰後にAPI成功・1件への絞り込みを確認する。
- uploadは取消後の破棄確認を通し、編集継続時の入力保持・破棄後に同じファイルを再選択した際の初期化まで確認する。

## 完走を阻んでいた問題の修正

- TanStack Startを1.168.47から1.168.55へ合わせ、直接依存しているSolid Router 1.170.36 / router-core 1.171.32と二重化していた依存を解消。devのRouter contextエラーとproductionのSSR export解決失敗を修正した。
- 起動・ビルドのstdout/stderrと終了状態を、隔離runtimeの `server.log` に保存。Playwrightの起動待ちタイムアウト時にも調査できるよう、失敗メッセージにログの場所を出す。報告された120秒タイムアウト自体は同じ条件で再現できていないため、exit 143だけから原因を断定しない。
- Bun 1.4.2でproduction bundleの後から `sharp` を初期化すると、最初の `metadata()` 呼び出しが同期的に停止し、HTTP応答も止まった。通常の `start` と隔離E2Eのpreloadでbundleより先に読み込むようにした。画像処理ジョブ完了と実source syncを使うSSE検証で確認した。
- 詳細画面はqueryの初回読み込みをローカルのSuspenseで受け、空画面になる代わりに既存のdetail skeletonを表示する。
- 詳細から一覧へ戻る操作は、直前の一覧の履歴entryが残っていればそこへ戻す。新しいentryで検索スクロール位置を失う問題を修正。直接URLで入った場合の保存URLへのfallbackも維持する。
- 短い画面でsidebarの子要素が縮んで重なる問題、検索filterのfooterが画面外へ出る問題を修正。filterは実際に空いている高さを上限にし、本文だけをスクロールさせる。
- 古いHome・見出し・件数・ボタン名・inline filter・source cardを前提とした操作を、現行のUIに合わせた。画像zoomはviewerを開いてから操作し、SSEは別タブの実source syncで発火させる。
- 閉じたpopoverのDOM同一性、廃止済みのsource操作dialog、viewer背景の透明色固定など、現行仕様と無関係なassertionを除いた。一覧DOMの保持、export内容、画像pixel比較、touch target、横overflow、focusの検証は維持した。
- gallery専用のNoto Sans 5.3.0をdev dependencyとして固定。読み込みと適用を確認してから画像比較する。OSフォント差による折り返しの変化を除き、目視確認したbaselineを更新した。本体のフォントは変更していない。

## 実行方法

リポジトリのルートから実行する。

```bash
bun run test                                         # 全workspaceの通常テスト
bun run test --project server-unit e2e-arguments     # Vitestの対象を絞る
bun run test:e2e                                     # dev代表ケース → fresh production全件
bun run test:e2e --mode=smoke                        # devの代表ケースだけを確認
bun run test:e2e --mode=dev route-reload.spec.ts     # 編集中のspecのみ
bun run test:e2e --mode=production                   # fresh productionのみ
bun run test:e2e --mode=components                   # DB不要のブラウザー内コンポーネント
bun run test:e2e --mode=full                         # dev・fresh productionとも全件
bun run test:e2e --list                              # 通常の実行対象を起動前に確認
```

dev の代表ケースは `@dev-smoke` で指定し、検索・詳細の直接URLとF5、SPA内の遷移、Tauriの起動と再接続設定の永続化、実CCIP推論、SSE再接続を検証する。対象ファイルに別のケースを追加すると、production全件と `--mode=dev` の全件実行で検証できる。

spec・行番号・`--grep`・`--project` で絞り込める。モードを省略してspecを指定するとその対象をdevとproductionで実行する。旧 `test:e2e:quick:dev` と同じ画面幅をまとめて検証するには `bun run test:e2e --mode=dev --project desktop responsive-desktop responsive-375 responsive-768` を使う。`bun run --cwd apps/server test` は引き続きserverのunit/integration、components、通常のアプリE2Eを順番に実行する。

`@desktop-only` / `@mobile-only` はprojectの `grepInvert` で収集時に振り分ける。画面幅に依存しない検証はdesktop、レイアウト・touch・breakpoint依存の検証は該当幅に置く。対応する画面幅を増やす際はタグの適用条件も確認する。

結果は `apps/server/test-results/{dev,production,components}/results.json`、HTMLは `apps/server/playwright-report/{dev,production,components}/`。モード間で上書きしない。JSONの `stats.duration` と各test resultの `duration`、project名、statusで遅いケースを追える。各モードはそのモードの次回実行で上書きされるため、比較用レポートは実行前に別の場所へ保存する。

アプリE2E失敗時は `/tmp/solid-imager-e2e/<mode>-<uuid>/server.log` も残る。成功した隔離runtimeは自動削除する。

## 2026-11-13 の計測

同じマシンで変更前後を各1回実行した。通常テストはコマンド全体の経過時間、ブラウザーテストは隔離環境の起動を含むPlaywrightの所要時間。

| 対象 | 変更前 | 変更後 | 実行内容 |
| --- | ---: | ---: | --- |
| 通常テスト | 30.0秒 | 25.7秒 | 比較時のVitest 971件、Node 9件、Bun 11件。Vitestは10プロジェクトを1回で実行 |
| dev代表ケース | 56.7秒 | 29.9秒 | 4ファイルの全20件からタグ付き7件へ変更 |
| コンポーネントE2E | 24.2秒 | 14.5秒 | 同じ24件。独立したgalleryを1ワーカーから2ワーカーへ変更 |

修正後の通常のアプリE2Eは14分03秒で完走した。うちfresh productionは274件すべて成功し、スキップ・再試行は0件。812.5秒のうち最初のテスト開始までが9.7秒、各テストの所要時間の合計が798.1秒だった。spec別の合計ではManagerのバッチ進捗（20件・117.5秒）、EmbeddingGemmaの実推論を含む検索（4件・73.2秒）、pixiv（25件・72.9秒）の順に長い。productionの一部はほかの検証と並行しており、全件の変更前後の短縮率は計測していない。

アプリE2Eは同一モード内でメディア、AI設定、SSEの同期対象を共有するため1ワーカーで実行する。実行開始時には隔離ソースの初回同期完了を待つ。EmbeddingGemmaのシナリオはテスト単位のfixtureでソースと画像を片付け、失敗時にも次の画面幅の検索結果に同名の画像が残るのを防ぐ。

Managerではラベル追加前のボタン名を探して1ケースにつき10秒待ち切るテストがあり、画面幅とジョブの種類ごとに繰り返していた。対象ソースの選択欄を現在のラベルで取得し、復元後の選択値も照合するようにした。

## 2026-09-23 の実測と未解決事項

- `bun run test`: 最終状態で89ファイル・411件成功。
- `bun run check`: Oxlint/Oxfmt、全workspaceのtypecheck、design lint成功。
- components: 固定フォントでbaselineを目視確認した後、更新オプションなしで7件成功、10.3秒。変更前の6成功・画像比較1失敗（14.5秒）との単純な速度比較には使わない。
- 変更前のdev全体: 165件収集、Tauri 4件成功後にWeb 3件失敗、86.3秒で打ち切り。残る158件を成功扱いしない。
- 棚卸し後の全件ベースライン: dev 97件成功（5.1分）、fresh production 97件成功（3.9分）。skip・flaky・unexpectedはいずれも0。galleryは上記の独立7件を1回実行する。
- 今回の通常ゲート: dev代表14件成功（1.4分）、fresh production全97件成功（4.2分）。両モード全件のベースライン約9.0分に対し約5.6分で、約3.4分短縮。production実行中に通常テストも並行したため、厳密な同一負荷ベンチマークではない。

### 次に適正化する順序

1. 全件成功時のdurationを基準に、遅いケースの前処理・API回数を追う。変更前のfail-fast結果から全体短縮率を推測しない。
2. 300ms/100msの固定待機、routeの性能予算、2画像pixelのdecode待ち、SSEテストの共有fixtureへの追記を点検する。特にworker数を増やす前に、各testのデータ分離・cleanupが必要。
3. API CRUDの雛形を消した箇所と、PGlite再接続・PostgreSQLとのparityは、実装を使うintegration testで補う。単に元の件数を埋め戻さない。

workers、retry、timeout、性能budgetを緩める変更は行っていない。新しい重複を防ぐため、追加テストには「実装をどう壊すと失敗するか」「ブラウザーが必要な理由」「どの幅・runtimeが必要か」をレビュー時に説明する。
