# パッケージ境界整理後の依存関係

公開 API 整理直前の `dcd8b6e2` と、メディアの用途別 port、MCP カタログ、Tauri のルートコンテキストを整理した `50d5336c` を比較した。テストを除くワークスペース間の参照は **875 → 758**、参照先のファイルは **190 → 103**。パッケージ間の依存方向は同じ15組で、各パッケージの内部構成を利用側が知る必要が減った。[パッケージ図](package-dependency-graph.md) · [ソース図](indexion-dependency-graph.md) · [旧 import の棚卸し](workspace-public-api.md)

## 利用側が参照するファイル

各行は、他のワークスペースの本番ソースから対象パッケージを直接参照する import、再 export、文字列リテラルの動的 import を集計したもの。ファイル数は別名経由の参照を同じ実ファイルにまとめた。

| 参照先 | 参照箇所（変更前 → 後） | 異なる参照先ファイル（変更前 → 後） |
| --- | ---: | ---: |
| core | 599 → 527 | 77 → 27 |
| application | 37 → 28 | 27 → 18 |
| db | 22 → 9 | 16 → 2 |
| ui | 202 → 179 | 69 → 55 |
| client | 15 → 15 | 1 → 1 |

DB では server が個別の repository factory や内部ヘルパーを import していた。現在は repository の組み立てが `@solid-imager/db`、テーブル定義の利用が `@solid-imager/db/schema` の2か所に収まる。メディアの検索・アップロード・転送は application 内で組み立て、server は `@solid-imager/application/media` の `createMediaService` を使う。

5つの共有パッケージで wildcard の export は **21 → 0**。対象の旧 `core/domain/*`、`application/services/*`、`application/ports/*`、`db/repositories/*` の直接参照は `src` 内で **674 → 0**（テスト込み）。管理スクリプト・設定を含む棚卸しは **681 → 0** で、対象が異なる。[集計範囲と移行先](workspace-public-api.md)

## グラフ全体と残る循環

| 指標 | 変更前 | 変更後 |
| --- | ---: | ---: |
| 解析した TS・JS ファイル | 771 | 811 |
| AST の参照箇所（テスト込み） | 3,998 | 3,887 |
| 一意なソース図の辺（参照元・参照先・種別） | 3,902 | 3,793 |
| 本番ソースの参照箇所（外部・パッケージ内を含む） | 3,194 | 3,137 |
| ワークスペース間の循環グループ | 0 | 0 |
| ファイル間の静的な値参照の循環グループ | 0 | 0 |
| 動的 import を含む値参照の循環グループ | 1 | 0 |
| 型参照も含めた循環グループ | 3 | 1 |

以前は `appRouter` が設定ルーターを登録し、そのハンドラが読み込む MCP カタログが `appRouter` を参照していた。現在は API と MCP が同じ `featureRouters` を使う。カタログは共有の `appContract` から公開候補を調べ、設定用の操作を除いて機能ルーターの実装と結び付ける。設定ハンドラからカタログへの遅延読み込みは維持され、カタログから設定ルーターへ戻る経路がなくなった。[ルーター登録](../../apps/server/src/infrastructure/api/app-router.ts) · [機能ルーター](../../apps/server/src/infrastructure/api/feature-routers.ts) · [カタログ生成](../../apps/server/src/infrastructure/mcp/catalog.ts)

```mermaid
flowchart LR
  router["appRouter"] --> config["configRouter"]
  router --> features["featureRouters"]
  config -->|dynamic import| catalog["MCP catalog"]
  catalog --> features
  catalog --> contract["appContract"]
```

カタログの122件について、変更前後で名前・順序・入力 schema・表示情報・実行可能な procedure の有無がすべて一致した。API 全体の組み立てを読み込まずにカタログを構築し、登録された `tags_list` が API と同じ実装を使うことを[回帰テスト](../../apps/server/src/tests/unit/architecture/mcp-catalog.test.ts)で確認する。

動的 import を含む実行時の循環は0件。両時点で core から他のワークスペースへの依存、application から infrastructure への逆向き依存も0件だった。

### ルートツリーの型参照

Tauri のルートコンテキストは、利用するルートの親である `__root.tsx` に定義した。`createRouter` は生成ツリーからコンテキストの型を推論し、起動時に渡す `queryClient` をその型で検査する。`__root.tsx` から `router.tsx` への型参照が消え、Tauri の循環は0件になった。[Tauri のルート定義](../../apps/tauri/src/routes/__root.tsx) · [ルーターの組み立て](../../apps/tauri/src/router.tsx)

残る1組は Web の `router.tsx` と `routeTree.gen.ts`。前者はルーターを作るために生成ツリーを読み込み、後者は TanStack Start の `Register.router` に `Awaited<ReturnType<typeof getRouter>>` を登録するため、前者を型として参照する。この型 import は実行時には消える。[Web のルーター](../../apps/server/src/router.tsx)

インストール済みの `@tanstack/start-plugin-core` 1.171.55 とルートジェネレーターを使い、空の `routeTreeFileFooter: []` と独自フッターの両方でツリーを新規生成した。どちらにも Start の型登録が入り、独自フッターはその後ろに追加された。Web はこの自動登録を維持した。両アプリの型検査では、既知のメディアルートを受理し未知のルートを拒否すること、ソース ID が `string`、ローダーのコンテキストが `QueryClient` を持つことを確認した。

## 集計方法

- 9ワークスペースの `src` にある TS・JS を解析した。ソース図にはテストを含め、パッケージ図と循環数では `tests/`、`__tests__/`、`*.test.*`、`*.spec.*`、`test-utils.*` からの参照を除いた。Web・Tauri の `routeTree.gen.ts` も対象に含めた。両コミットでルートのパス一覧が同じことを確認し、比較には同じ生成ファイルを使用した。
- 前回と同じ Babel AST 解析で宣言・型位置・リテラルの動的参照を分類し、各コミットの tsconfig、package exports、実ファイルから参照先を解決した。構文解析エラーと未解決の内部参照はいずれも両コミットで0件。循環数はワークスペース単位またはファイル単位の強連結成分で数えた。
- 変更後の indexion 0.19.0 は1,949件を抽出した。同じ参照元と module specifier が indexion 出力にない AST 参照は1,942箇所（import 1,611、再 export 184、動的 import 107、型位置の import 40）。変更前には indexion が拾わなかった動的循環もあったため、循環の有無は AST の参照先で検証した。図には AST で確認した辺を使った。

indexion の JSON はリポジトリのルートで再取得できる。この環境では AGENTS.md に従いサンドボックス外で実行する。

```sh
indexion doc graph --format=json --output=/tmp/solid-imager-indexion-dependencies.json \
  apps/cli/src apps/server/src apps/tauri/src apps/xtracter/src \
  packages/application/src packages/client/src packages/core/src \
  packages/db/src packages/ui/src
```

この作業環境で使った AST 集計・描画スクリプトと両時点の集計 JSON は `.indexion/audits/2026-11-04/` に保存した（Git 管理外）。11月1日の監査は当時のコードを対象としている。[前回の監査](dependency-audit-2026-11-01.md)
