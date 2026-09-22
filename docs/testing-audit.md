# テスト棚卸し（2026-09-22）

今回の対象は、テストの検出力、実行対象の漏れ、E2Eの重複実行と起動コスト。テストが落ちること自体は削除理由にしない。実装に触れない成功確認を除去し、ブラウザーが必要な回帰検証を残した。

## 判断基準

| 判断 | 基準 |
| --- | --- |
| 残す | 実装を呼び、利用者に影響する失敗を検出する。ブラウザー固有の表示、操作、履歴、フォーカス、再接続はブラウザーで検証する |
| 集約する | 同じ入力規則、画面幅に依存しない処理、同じfixtureを繰り返している |
| 強化する | 出力の存在だけを見ており、壊れた内容でも通る |
| 削除する | 定数の自己比較、手作りのレスポンスの自己比較、コメントだけのテスト、完了した移行のディレクトリ存在確認 |
| 調査を続ける | 実際に失敗している、古い画面操作を参照する、外部条件で揺れる。通すためにassertionを弱めない |

## 数量と実行対象

Playwrightの `--list --reporter=json` による収集数。成功数やカバレッジ率ではない。

| 対象 | 変更前 | 変更後 |
| --- | ---: | ---: |
| アプリE2E（1モード、旧構成はgalleryを含む） | 165 | 97 |
| アプリdev + production | 330 | 194 |
| 独立したコンポーネント検証 | 上記に7件×2回を内包 | 7件×1回 |
| ブラウザー検証の合計 | 330 | 201 |
| 重複プロジェクトを除いたシナリオ数 | 69 | 69 |

収集数は129件（39%）減。旧構成には実行時skipが1モード19件含まれるため、実際に本体を実行する予定数は292件から201件へ減る。これを実時間の39%短縮とは扱わない。Webの既存障害があるため、全体の完走時間はまだ比較できない。

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
| `loading-recovery` | 11→11 | 初期pending、背景更新中の結果・入力保持、再試行、ネットワーク各障害。維持。offlineの改善候補は下記 |
| `media-detail-manager-config.responsive` | 20→14 | 2枚目への遷移を画像pixelで確認する検証、画面幅別の可用性を維持。保存URL・履歴stackはdesktopに集約 |
| `realtime-preservation` | 1→1 | SSE再接続後に実source eventで内容更新し、dialog・入力・focusを保持。維持 |
| `route-reload` | 7→8 | 各routeの直接URL/F5、SSR HTML、hydration、query数。Jobs/Aboutを追加。操作せず見出しだけ見る「interactive」ケースは削除 |
| `routes.responsive` | 32→13 | 各幅のroute表示・overflowを維持し、F5の繰り返しを `route-reload` に集約。2枚目表示の弱い重複をpixel検証へ集約。固定viewport・exportはdesktop限定 |
| `scroll-restoration` | 4→4 | 戻る経路×collectionで復元中のscroller消失・ページ追加時の位置飛びを検出。galleryの仮想grid検証とは境界が異なるため維持 |
| `search-history` | 2→2 | detail往復、送信直後の検索状態保存。UI・session・ルーターをまたぐため維持 |
| `search-pro-dialog.responsive` | 4→1 | 入力中のfocus保持。desktop専用を収集時に選択 |
| `search-realtime-preservation.responsive` | 8→4 | mobileの検索draft・focusをSSE更新中も保持。mobileだけを収集 |
| `search.responsive` | 4→4 | filterの取消・適用、狭い画面のoverflow、スクロール到達性。維持 |
| `sources-source-media.responsive` | 16→7 | redirect・context menuをdesktopに集約。touch選択、dialog、file chooserは画面幅別に維持 |
| `tauri-migration` | 4→4 | Tauri用SPAのshared画面、preview/detail、source/import dialog。Webとは別entryを通るため維持。native desktop自体の検証ではない |
| `ui-components.gallery` | 7→独立7 | keyboard/overlay、仮想grid、深いscroll、DPR画像選択、画像比較。DB/AI/app serverを起動せず実行 |

### 今回強化した検証

- ManagerのNDJSON/TAR exportは拡張子だけでなく、ダウンロードの完了・エラーなし・metadata内のseeded media 2件を確認する。TARは「Include original media」を選択し、格納された原画像のbytesもfixtureと比較する。
- sidebarの間隔チェックはlinkがなくても `Math.min(...[]) === Infinity` で通ってしまうため、測定対象が存在することも確認する。
- 共通browser healthは、独自の日本語error画面に加えて、実際に観測したTanStack標準の `Something went wrong!` も失敗として扱う。
- galleryにも同じbrowser healthを適用し、console/page/networkの異常を見落とさない。

exportの新しい内容assertionはtypecheck済みだが、Webの既存起動障害に阻まれ、ブラウザー経由での成功は未確認。

## 実行方法

```bash
# 日常のunit / integration。client・DBも含む
bun run test

# ブラウザー内のコンポーネント。DB・native AIは不要
bun run --cwd apps/server test:e2e:components

# アプリE2E（galleryを除く）。dev / fresh production
bun run --cwd apps/server test:e2e
bun run --cwd apps/server test:e2e:dev
bun run --cwd apps/server test:e2e:production

# serverのunit/integration + components + dev/production E2E
bun run --cwd apps/server test

# 全projectを起動せず、対象だけ確認
bun run --cwd apps/server test:e2e:dev -- routes.responsive.spec.ts --project=responsive-desktop
bun run --cwd apps/server test:e2e:dev -- --list
```

`test:e2e:quick` はdesktop・responsive-desktop・375・768を選ぶ。従来はresponsive-desktopを含まず、desktop限定の選択・pro入力テストまで抜けていたため追加した。320とTauri、独立componentsはquickに含まれない。完全なゲートの代わりにはしない。

`@desktop-only` / `@mobile-only` はprojectの `grepInvert` で収集時に振り分ける。画面幅に依存しない検証はdesktop、レイアウト・touch・breakpoint依存の検証は該当幅に置く。対応する画面幅を増やす際はタグの適用条件も確認する。

結果は `apps/server/test-results/{dev,production,components}/results.json`、HTMLは `apps/server/playwright-report/{dev,production,components}/`。モード間で上書きしない。JSONの `stats.duration` と各test resultの `duration`、project名、statusで遅いケースを追える。各モードはそのモードの次回実行で上書きされるため、比較用レポートは実行前に別の場所へ保存する。

## 実測と未解決事項

- `bun run test`: 最終状態で89ファイル・411件成功。
- `bun run check`: Biome、全workspaceのtypecheck、design lint成功。
- components: 変更前の設定で6成功・1失敗、14.5秒。分離後も同じ6成功・同じ画像比較1失敗、10.4秒。各1回の参考値で、安定したベンチマークではない。
- 変更前のdev全体: 165件収集、Tauri 4件成功後にWeb 3件失敗、86.3秒で打ち切り。残る158件を成功扱いしない。
- devのWebは `null is not an object (evaluating 'router.options')` と標準error boundaryを表示。最終状態の対象テストでも再現。先にこの障害を解消し、その後に古いlocatorと実際のUI不具合を切り分ける。
- productionはブラウザー到達前のビルドで失敗。TanStackの `defaultSerovalPlugins`、`makeSsrSerovalPlugin`、`disposeSsrResponseDetached` 等のexportを解決できない。今回依存・lockfile・アプリ本体は変更していない。
- gallery画像比較は期待320×1881、実際320×1825。変更前後で同じ差分を観測した。画像自体は確認したが、文字幅・折り返し差の原因（font/runtime/CSS）を確定していないため、baselineの更新は保留。

### 次に適正化する順序

1. Webのdev起動とproduction buildを直し、全体を最後まで実行してdurationの基準を取る。現在のfail-fast結果から遅い順や全体短縮率を推測しない。
2. 古い画面前提（`Home`、`メディア検索`、`Filter results`、旧source card等）を現行UIに合わせ、検索・pending・reconnectの本来の保証を回復する。単に見つかる別要素へ置き換えない。
3. `loading-recovery` のofflineは現在synthetic eventで表示を確認するだけ。実際の通信断・再接続を保証するには `BrowserContext.setOffline` と復帰後のAPI/UI更新を確認する。現状の名前以上の保証を主張しない。
4. 300ms/100msの固定待機、routeの性能予算、2画像pixelのdecode待ち、SSEテストの共有fixtureへの追記を点検する。特にworker数を増やす前に、各testのデータ分離・cleanupが必要。
5. API CRUDの雛形を消した箇所と、PGlite再接続・PostgreSQLとのparityは、実装を使うintegration testで補う。単に元の件数を埋め戻さない。

workers、retry、timeout、性能budgetを緩める変更は行っていない。新しい重複を防ぐため、追加テストには「実装をどう壊すと失敗するか」「ブラウザーが必要な理由」「どの幅・runtimeが必要か」をレビュー時に説明する。
