# テスト戦略

`apps/server` のテスト構成。Vitest（unit/integration）+ Playwright（E2E）の3層構造。

## テスト種別と使い分け

| 種別     | 設定ファイル                   | 対象ディレクトリ                    | DB                          |
| -------- | ------------------------------ | ----------------------------------- | --------------------------- |
| ユニット | `vitest.unit.config.ts`        | `src/tests/unit/`, `src/tests/api/` | モック（vitestの`vi.mock`） |
| 統合     | `vitest.integration.config.ts` | `src/tests/integration/`            | PGlite（実DB、インメモリ）  |
| E2E      | Playwright                     | `src/tests/e2e/`                    | 起動中のサーバー            |

```bash
bun --filter @solid-imager/server run test         # ユニット
bun --filter @solid-imager/server run test:integration  # 統合
bun run test:e2e                                   # E2E
```

## ユニットテスト

**セットアップ**: `src/tests/setup-unit.ts`

DBは `vi.mock("~/infrastructure/db")` でモック化。モックオブジェクトは固定UUIDを返すハードコードされたスタブ。

```typescript
// ユニットテストのパターン
import { describe, it, expect } from "vite-plus/test";
import { MediaService } from "~/application/services/media-service";

describe("MediaService", () => {
	it("should search media", async () => {
		const result = await MediaService.searchMedia("source-id", { limit: 10 });
		expect(result.items).toHaveLength(1); // モックの固定値が返る
	});
});
```

**モックの注意**: DBモックは `vi.hoisted()` ブロック内で定義すること（Vitestのホイスティング制約）。

## 統合テスト

**セットアップ**: `src/tests/setup-integration.ts`

PGliteをインメモリで起動し、`apps/server/drizzle/` のマイグレーションを全適用してからテストを実行。**実際のSQL**が走るため、リポジトリ実装のバグを検出できる。

```typescript
// 統合テストのパターン
import { describe, it, expect } from "vite-plus/test";
import { db } from "~/infrastructure/db";

describe("MediaRepository integration", () => {
  it("should persist and retrieve media", async () => {
    // 実際のDBに書き込み・読み込み
    const inserted = await db.insert(medias).values({...}).returning();
    expect(inserted[0].id).toBeTruthy();
  });
});
```

**重要な設定**:

- `pool: "forks"` + `singleFork: true` — 統合テストは**シングルプロセスで順次実行**（DB共有のため並列化しない）
- `DB_HOST: "pglite"` を環境変数に設定することでPGliteが選択される

## テストとDBモックのポリシー

| ルール                           | 理由                                                   |
| -------------------------------- | ------------------------------------------------------ |
| **統合テストでDBをモックしない** | モックとPostgreSQL互換の乖離でバグを見逃した経緯がある |
| **ユニットテストはモックOK**     | サービスロジックの単体検証が目的のため                 |
| **PGliteをテストDBとして使用**   | Dockerなしでpostgres互換のSQLが動くため                |

## テスト構成（`src/tests/`）

```
src/tests/
├── setup-unit.ts           # ユニットテスト共通セットアップ
├── setup-integration.ts    # 統合テスト共通セットアップ（PGlite初期化）
├── setup.ts                # 両テスト共通（logger mock等）
├── unit/
│   ├── application/services/   # サービス層ユニットテスト
│   ├── domain/                 # ドメインロジックテスト
│   ├── infrastructure/         # インフラ層ユニットテスト
│   └── security/               # セキュリティテスト（パストラバーサル等）
├── integration/
│   ├── media/                  # メディアCRUD統合テスト
│   ├── repository/             # リポジトリ統合テスト
│   ├── backup/                 # バックアップ統合テスト
│   ├── db/                     # DB互換性テスト（PGlite/Postgres parity）
│   ├── queries/                # 検索クエリテスト
│   └── security/               # セキュリティ統合テスト
├── api/                        # APIルーターテスト（ユニット扱い）
└── e2e/
    └── pages.spec.ts           # Playwrightページテスト
```

## E2Eテスト

Playwrightを使用。サーバーを実際に起動してブラウザ操作を検証。

```bash
bun run test:e2e
```

設定: `playwright.config.ts`（ルート）

## packages/ui のテスト

```bash
bun --filter @solid-imager/ui run test
```

設定: `packages/ui/vitest.config.ts`
