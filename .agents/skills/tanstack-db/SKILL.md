---
name: tanstack-db
description: TanStack DBを用いたクライアント側データレイヤーの実装。コレクション定義、永続化設定、useLiveQueryフックの使用、includesによる階層的データ投影を行う際に使用してください。
---

# TanStack DB Skill

TanStack DBは、クライアント側のリアクティブデータレイヤー。TanStack Queryと統合しつつ、永続化・オフライン対応・階層的データ投影を提供する。

## パッケージ構成

| パッケージ | 用途 |
|---|---|
| `@tanstack/db` | コア（フレームワーク非依存） |
| `@tanstack/solid-db` | Solid用フック (`useLiveQuery`) |
| `@tanstack/query-db-collection` | TanStack Query統合 (`queryCollectionOptions`) |
| `@tanstack/tauri-db-sqlite-persistence` | Tauri専用SQLite永続化 |
| `@tanstack/browser-db-sqlite-persistence` | ブラウザSQLite永続化 (serverアプリ用) |

## Task Routing

| ユーザーの意図 | やること |
|---|---|
| 新しいコレクション追加 | `collections/{entity}-collection.ts` にファクトリ関数を定義 |
| コンポーネントでデータ取得 | `useLiveQuery` でコレクションを参照 |
| 永続化スキーマ変更 | `schemaVersion` をインクリメント |
| 階層的データ投影 | `includes`（サブクエリ）を使用 |
| serverアプリへの展開 | 永続化アダプタを `browser-db-sqlite-persistence` に差し替え |

## Tauriアプリの構成

```
apps/tauri/src/
├── infrastructure/db/
│   └── persistence.ts          # 永続化初期化（エラーラッパー含む）
├── collections/
│   ├── index.ts                # 全コレクションの初期化・エクスポート
│   ├── tags-collection.ts
│   ├── sources-collection.ts
│   ├── projects-collection.ts
│   ├── characters-collection.ts
│   ├── ips-collection.ts
│   └── authors-collection.ts
└── main.tsx                    # initializeCollections() → render
```

## コレクション定義パターン

### ファクトリ関数パターン

永続化インスタンスは非同期初期化のため、コレクションはファクトリ関数として定義する:

```typescript
// collections/tags-collection.ts
import { createCollection } from "@tanstack/db";
import { queryCollectionOptions } from "@tanstack/query-db-collection";
import { persistedCollectionOptions } from "@tanstack/tauri-db-sqlite-persistence";
import { client } from "~/orpc-client";
import { queryClient } from "~/router";
import type { getPersistence } from "~/infrastructure/db/persistence";

type TagResponse = Awaited<ReturnType<typeof client.tags.list>>[number];

export function createTagsCollection(
  persistence: ReturnType<typeof getPersistence>,
) {
  return createCollection(
    persistedCollectionOptions<TagResponse, string>({
      id: "tags",
      persistence,
      schemaVersion: 1,
      ...queryCollectionOptions({
        queryKey: ["tags"],
        queryFn: () => client.tags.list(),
        queryClient,
        getKey: (tag) => tag.id,
      }),
    }),
  );
}
```

### 初期化パターン（直列化必須）

```typescript
// collections/index.ts
import { initializePersistence } from "~/infrastructure/db/persistence";
import { createTagsCollection } from "./tags-collection";
// ... 他のコレクション

export type AppCollections = {
  tags: ReturnType<typeof createTagsCollection>;
  // ... 他の型
};

let collections: AppCollections | null = null;

export async function initializeCollections() {
  if (collections) return collections;
  const persistence = await initializePersistence();

  // 重要: 最初のコレクションを1つ作成して refetch で内部テーブルを初期化する。
  // TanStack DB の ensureInitialized() が並行呼び出しに未対応なため、
  // 最初の1つを完了させてから残りを作成する。
  const tags = createTagsCollection(persistence);
  await tags.utils.refetch();

  collections = {
    tags,
    sources: createSourcesCollection(persistence),
    // ... 他のコレクション
  };
  return collections;
}

export function getCollections() {
  if (!collections) {
    throw new Error("Collections not initialized.");
  }
  return collections;
}
```

### main.tsxでの起動

```typescript
import { initializeCollections } from "./collections";

initializeCollections().then(() => {
  render(() => <RouterProvider router={router} />, root);
});
```

## コンポーネントでの使用

### useLiveQuery（基本）

```typescript
import { useLiveQuery } from "@tanstack/solid-db";
import { getCollections } from "~/collections";

function TagList() {
  const { tags } = getCollections();
  const tagQuery = useLiveQuery(() => tags);

  return (
    <ul>
      <For each={tagQuery()}>
        {(tag) => <li>{tag.name}</li>}
      </For>
    </ul>
  );
}
```

### useLiveQuery（フィルタ付き）

```typescript
import { useLiveQuery, eq } from "@tanstack/solid-db";

function SourceTags({ sourceId }: { sourceId: string }) {
  const { tags } = getCollections();
  const sourceTags = useLiveQuery((q) =>
    q.from({ tag: tags })
     .where(({ tag }) => eq(tag.source, sourceId))
  );

  return <For each={sourceTags()}>{(tag) => <span>{tag.name}</span>}</For>;
}
```

### includes（階層的データ投影）

```typescript
import { createLiveQueryCollection, eq } from "@tanstack/db";

const charactersWithIps = createLiveQueryCollection((q) =>
  q.from({ character: charactersCollection }).select(({ character }) => ({
    id: character.id,
    name: character.name,
    ips: q
      .from({ ip: ipsCollection })
      .where(({ ip }) => eq(ip.characterId, character.id))
      .select(({ ip }) => ({ id: ip.id, name: ip.name })),
  })),
);
```

## 永続化の設定

### Tauri (`@tanstack/tauri-db-sqlite-persistence`)

**重要: Tauri SQLプラグインのエラーラッパー必須**

Tauri SQLプラグインはエラーを `string` で reject するが、TanStack DB の `isDuplicateColumnAddError()` は `instanceof Error` をチェックする。この不整合により、`ALTER TABLE ADD COLUMN` の重複エラーがクラッシュする。database オブジェクトをラップして string エラーを `Error` に変換する:

```typescript
import Database from "@tauri-apps/plugin-sql";
import { createTauriSQLitePersistence } from "@tanstack/tauri-db-sqlite-persistence";

function wrapDatabaseWithErrorNormalization(
  database: InstanceType<typeof Database>,
) {
  return {
    path: database.path,
    execute: async (query: string, bindValues?: unknown[]) => {
      try {
        return await database.execute(query, bindValues);
      } catch (e: unknown) {
        if (typeof e === "string") throw new Error(e);
        throw e;
      }
    },
    select: async <T>(query: string, bindValues?: unknown[]): Promise<T> => {
      try {
        return await database.select<T>(query, bindValues);
      } catch (e: unknown) {
        if (typeof e === "string") throw new Error(e);
        throw e;
      }
    },
    close: database.close?.bind(database),
  };
}

const rawDatabase = await Database.load("sqlite:solid-imager.db");
const database = wrapDatabaseWithErrorNormalization(rawDatabase);
const persistence = createTauriSQLitePersistence({ database });
```

**Tauri設定ファイル:**

- `src-tauri/Cargo.toml`: `tauri-plugin-sql = { version = "2", features = ["sqlite"] }`
- `src-tauri/src/lib.rs`: `.plugin(tauri_plugin_sql::Builder::new().build())`
- `src-tauri/capabilities/main.json`: SQL権限を明示的に追加:

```json
"sql:default",
"sql:allow-execute",
"sql:allow-select",
"sql:allow-load",
"sql:allow-close"
```

**DBファイルの場所:** Tauri SQLプラグインは `app_config_dir()` を使うため:
- Linux: `~/.config/{app-identifier}/solid-imager.db`
- macOS: `~/Library/Application Support/{app-identifier}/solid-imager.db`

### ブラウザ (`@tanstack/browser-db-sqlite-persistence`) — serverアプリ用

```typescript
import {
  createBrowserWASQLitePersistence,
  openBrowserWASQLiteOPFSDatabase,
} from "@tanstack/browser-db-sqlite-persistence";

const database = await openBrowserWASQLiteOPFSDatabase({
  databaseName: "solid-imager.db",
});
const persistence = createBrowserWASQLitePersistence({ database });
```

## TanStack Queryとの共存

既存の `createQuery()` と `useLiveQuery()` は共存可能:

| | `createQuery` (既存) | `useLiveQuery` (新規) |
|---|---|---|
| データソース | TanStack Queryキャッシュ | TanStack DBコレクション |
| 永続化 | なし | SQLite |
| オフライン | キャッシュのみ | 完全対応 |
| リアクティブ | ポーリング/refetch | ファイングレイン |

**移行方針:** 段階的に `createQuery` → `useLiveQuery` に置き換え。両方同時に動作する。

## SourcesScreen との統合

`SourcesScreen` の `isLoading` / `isError` / `error` は accessor ではなくプレーンな値を期待する:

```typescript
// ❌ 型エラー
<SourcesScreen isLoading={() => false} isError={() => false} error={() => null} />

// ✅ 正しい
<SourcesScreen isLoading={false} isError={false} error={null} />
```

`mediaSources` のみ accessor を期待する: `mediaSources={() => mediaSources()}`

mutation 後はコレクションの `refetch()` を呼ぶ:

```typescript
actions: {
  createMediaSource: async (data) => {
    await createMediaSource(mediaSourceInfoSchema.parse(data));
    await sources.utils.refetch();
  },
},
```

## schemaVersion の扱い

- 永続化スキーマを変更する場合、`schemaVersion` をインクリメント
- 同期コレクションの場合: ローカルキャッシュがクリアされ、サーバーから再同期
- ローカルのみの場合: アプリ側でマイグレーション処理が必要

## mutation の扱い

コレクションはデータ取得と永続化を担当。mutation（作成・更新・削除）は既存のAPI層 (`~/api/`) を引き続き使用:

```typescript
// 既存のAPI呼び出しはそのまま
import { createTag, updateTag, deleteTag } from "~/api/tags-api";

// mutation後はコレクションをリフェッチ
const { tags } = getCollections();
await tags.utils.refetch();
```

## トラブルシューティング

### `sql.execute not allowed` エラー
`capabilities/main.json` に `sql:allow-execute`, `sql:allow-select`, `sql:allow-load`, `sql:allow-close` を追加。

### `duplicate column name: replay_json` エラー
Tauri SQLプラグインがstringでrejectするため、TanStack DBのエラーハンドリングが機能しない。`persistence.ts` の `wrapDatabaseWithErrorNormalization` でラップする。

### DBファイルが見つからない
Tauri SQLプラグインは `app_config_dir()` を使う。Linuxなら `~/.config/{identifier}/` に作成される。`~/.local/share/` ではない。

### コンソールエラーが出ないがデータが空
`collections/index.ts` で最初のコレクションの `refetch()` を await していない可能性。直列化を確認。

## 注意事項

- `getKey` は各エンティティの一意キーを返す関数（通常 `item.id`）
- `queryClient` はルーターで定義されたものをインポートして使用
- 永続化はアプリ起動時に1回だけ初期化する
- コレクションはモジュールレベルではなくファクトリ関数で作成する（永続化の非同期初期化のため）
- TanStack DB の `ensureInitialized()` は並行呼び出しに未対応。最初のコレクションを `refetch()` で完了させてから残りを作成する
