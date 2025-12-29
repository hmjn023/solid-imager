# Plan: Domain Layer Purification v2 (段階的移行)

このプランは、機能を維持しながらDomain層を純粋化するための**段階的移行戦略**です。

## 移行の原則

1. **一度に1つのサービスのみ移行する**
2. **各ステップで動作確認を行う**
3. **古い実装を残しながら新しい実装を追加する**
4. **テストを先に書く（可能な場合）**
5. **ビルドエラーが出ない状態を維持する**

## Phase 1: 基盤の準備（既存機能に影響なし）

### Step 1.1: Repository Interfaceの定義

`src/domain/repositories/` に型定義のみを追加します。既存コードには影響しません。

**作成するファイル:**
- `src/domain/repositories/media.repository.ts`
- `src/domain/repositories/source.repository.ts`
- `src/domain/repositories/tag.repository.ts`
- その他必要なrepository interface

**注意点:**
- インターフェースのみを定義し、実装はまだ作らない
- Domain層の型（Zodから推論した型）を使用する
- Drizzle型への依存を避ける

**検証:**
```bash
bun run check
bun run build
```

### Step 1.2: Transaction Manager Interfaceの定義

`src/domain/interfaces/transaction-manager.ts` を作成します。

**検証:**
```bash
bun run check
```

## Phase 2: 1つのサービスでの実証（MediaSource）

MediaSourceServiceを例として、完全な移行フローを確立します。

### Step 2.1: MediaSource Repository実装の作成

**新規ファイル:** `src/infrastructure/repositories/source-repository.ts`

```typescript
import type { ISourceRepository } from "~/domain/repositories/source.repository";
import { 
  selectMediaSources, 
  selectMediaSourceById,
  insertMediaSource,
  updateMediaSource,
  deleteMediaSource 
} from "~/infrastructure/db/queries/media-sources";

export class DrizzleSourceRepository implements ISourceRepository {
  async findAll() {
    return await selectMediaSources();
  }
  
  async findById(id: string) {
    return await selectMediaSourceById(id);
  }
  
  async create(source) {
    const result = await insertMediaSource(source);
    return result[0];
  }
  
  async update(id: string, source) {
    return await updateMediaSource(id, source);
  }
  
  async delete(id: string) {
    const result = await deleteMediaSource(id);
    return result[0];
  }
}
```

**検証:**
```bash
bun run check
bun run build
```

### Step 2.2: MediaSourceServiceの段階的リファクタリング

**重要:** 既存の実装を残したまま、新しいRepositoryを使う**別のバージョン**を作成します。

**新規ファイル:** `src/application/services/media-source-service-v2.ts`

```typescript
import { DrizzleSourceRepository } from "~/infrastructure/repositories/source-repository";

const sourceRepo = new DrizzleSourceRepository();

export const MediaSourceServiceV2 = {
  fetchSources: async () => {
    return await sourceRepo.findAll();
  },
  // ... 他のメソッド
};
```

**検証:**
```bash
bun run check
bun run build
```

### Step 2.3: 1つのAPIエンドポイントで新サービスをテスト

**例:** `src/routes/api/sources/index.ts` の `GET` メソッドのみを新サービスに切り替え

```typescript
// 既存のimportはそのまま
import { MediaSourceService } from "~/application/services/media-source-service";
// 新しいサービスを追加
import { MediaSourceServiceV2 } from "~/application/services/media-source-service-v2";

export const GET = async () => {
  // 環境変数で切り替え可能にする
  const useV2 = process.env.USE_REPO_V2 === "true";
  const service = useV2 ? MediaSourceServiceV2 : MediaSourceService;
  
  const sources = await service.fetchSources();
  // ...
};
```

**検証:**
```bash
# 既存の実装で動作確認
bun run build
bun run test

# 新しい実装で動作確認
USE_REPO_V2=true bun run test
```

### Step 2.4: 全エンドポイントを新サービスに移行

全てのMediaSource関連エンドポイントを新サービスに切り替えます。

**検証:**
```bash
bun run test
bun run test:e2e
```

### Step 2.5: 古い実装の削除

新サービスが完全に動作することを確認したら：

1. `media-source-service-v2.ts` → `media-source-service.ts` にリネーム（古いファイルを上書き）
2. 環境変数による切り替えコードを削除
3. 未使用のimportを削除

**検証:**
```bash
bun run check
bun run test
bun run test:e2e
```

## Phase 3: 他のサービスへの展開

MediaSourceで確立したパターンを他のサービスに適用します。

**優先順位:**
1. TagService（比較的シンプル）
2. CategoryService
3. CharacterService
4. IpService
5. ProjectService
6. MediaService（最も複雑、最後に実施）

**各サービスで同じフローを繰り返す:**
1. Repository実装を作成
2. ServiceV2を作成
3. 1つのエンドポイントでテスト
4. 全エンドポイントを移行
5. 古い実装を削除

## Phase 4: クリーンアップ

全サービスの移行が完了したら：

1. `src/infrastructure/db/queries/` の未使用ファイルを削除
2. Domain層からInfrastructure層へのimportがないことを確認
3. ドキュメントの更新

## 各ステップでの検証チェックリスト

- [ ] `bun run check` が成功する
- [ ] `bun run build` が成功する
- [ ] 既存のテストが全て通る
- [ ] 新しい実装でテストが通る（環境変数で切り替え）
- [ ] 手動でUIから動作確認

## ロールバック戦略

各Phaseで問題が発生した場合：

1. **Phase 1**: ファイルを削除するだけ（既存コードに影響なし）
2. **Phase 2**: 環境変数を `false` に戻す
3. **Phase 3**: 該当サービスのみロールバック（他のサービスは影響なし）

## 成功の鍵

1. **焦らない** - 1つのサービスを完全に移行してから次へ
2. **テストを書く** - 各ステップで動作確認
3. **小さく始める** - 最もシンプルなサービスから開始
4. **並行実行** - 古い実装と新しい実装を並行して動かせるようにする
5. **段階的削除** - 新しい実装が完全に動作することを確認してから古い実装を削除

## 推定作業時間

- Phase 1: 2-3時間（インターフェース定義のみ）
- Phase 2: 4-6時間（1つのサービスで完全なフローを確立）
- Phase 3: 各サービス2-3時間 × 6サービス = 12-18時間
- Phase 4: 2-3時間（クリーンアップ）

**合計: 20-30時間**（一度に全て行うのではなく、数日に分けて実施）
