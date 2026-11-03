# パッケージ境界の棚卸し

[Issue #543](https://github.com/hmjn023/solid-imager/issues/543) の対象だった `core`、`application`、`db` の内部パスを、利用側が必要としていた機能で分類した。新しい import には各パッケージの `exports` と [AGENTS.md の公開 API 規約](../../AGENTS.md#パッケージの公開-api)を使う。

| 利用側 | 以前の用途 | 現在の入口 |
| --- | --- | --- |
| Web・Tauri・共有 UI・CLI・拡張 | `core/domain/*` から DTO・検索 schema・router 型を取得 | `@solid-imager/core/media` の `MediaDetails`、`@solid-imager/core/search` の `SearchState`、`@solid-imager/core/contract` の API 契約など |
| application | `core/domain/repositories/*` から repository 型を取得 | `@solid-imager/core/media` など各機能の port。ストレージやトランザクションは `@solid-imager/core/ports` |
| server の組み立て・管理スクリプト | `application/services/*` の具象クラス、`application/ports/*` の型、`db/repositories/*` の個別 factory を参照 | `@solid-imager/application/media` の `createMediaService`、`@solid-imager/application/ccip` などの機能別入口、`@solid-imager/db` の `createRepositories` |
| テスト・migration | server のテストから application の内部ヘルパーを参照。Drizzle はテーブル定義を必要とする | ファイル署名の単体テストは application 内で相対 import。server の結合テストは公開 factory を使い、Drizzle の設定は server の schema ファイル経由で `@solid-imager/db/schema` を使う |

## 移行前後の件数

`apps` と `packages` 以下の追跡済み TS・TSX で、下記の旧パスを参照する行を数えた。テスト列は `tests/`、`__tests__/`、`*.test.ts(x)`、`*.spec.ts(x)`。それ以外には設定と管理スクリプトも含む。

| 旧パス（`@solid-imager/` 以下） | 移行前・テスト以外 | 移行前・テスト | #836 適用後・全体 |
| --- | ---: | ---: | ---: |
| `core/domain/repositories/*` | 96 | 17 | 0 |
| その他の `core/domain/*` | 466 | 36 | 0 |
| `application/services/*` | 27 | 14 | 0 |
| `application/ports/*` | 8 | 1 | 0 |
| `db/repositories/*` | 15 | 1 | 0 |

以下で移行前の 681 行を再現できる。コミットを `7de41fd0`（[#836](https://github.com/hmjn023/solid-imager/pull/836)）に替えると該当行は 0 件になる。現在のブランチで新しい違反を調べるには `bun run lint:boundaries` を使う。

```sh
git grep -nE '(from[[:space:]]+|import\([[:space:]]*)"@solid-imager/(core/domain/|application/(ports|services)/|db/repositories/)' \
  dcd8b6e2 -- 'apps/**/*.ts' 'apps/**/*.tsx' 'packages/**/*.ts' 'packages/**/*.tsx'
```

## メディアの repository と facade

`@solid-imager/core/media` は 31 操作を次の 6 種類に分ける。DB adapter が実装し、server の registry に登録する `IMediaRepository` はこの 6 つの交差型。ユースケースは必要な操作を `Pick` で組み合わせる。

| Port | 用途 | 利用例 |
| --- | --- | --- |
| `MediaReader` | ID・パス・URL での取得、ソース内の列挙 | tagging は `findById`、ベクトル検索は `findById` と `findByIds` |
| `MediaWriter` | 単体の登録・更新・削除、URL・生成情報の書き込み | upload は `findByPath` と writer の `upsert`、`addUrls` |
| `MediaSearchRepository` | ソース内・横断・ディレクトリ検索、重複検出 | 横断検索の factory は `globalSearch` だけを受け取る |
| `MediaDetailsReader` | 詳細、タグ、生成情報、作者、URL、統計の取得 | transfer はコピー元の作者と URL を取得する |
| `MediaMaintenanceRepository` | メタデータ欠落・インデックス・パスの列挙 | 起動時の保守は欠落メタデータとサムネイルの対象を列挙する |
| `MediaBulkRepository` | 一括更新・削除・移動・タグ付け | server の一括操作は `findByIds` で所属ソースを確認してから書き込む |

server は `createMediaService` が返す `IMediaService` を利用する。検索・アップロード・転送のクラスとその依存型は application 内に置く。facade の検索と更新は Zod の入力型を受け取り、ユースケースで検証する。repository が受け取るのは既定値の入った検索条件や `Date` に変換済みの更新データになる。
