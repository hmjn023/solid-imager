# IPとキャラクターの結びつけ スキーマ変更

## 1. 要件定義

### 背景

現在キャラクター→IPの結びつけは、多対一（`characters`テーブルの`ip_id`カラム）でのみ行われている。
これでは、シリーズ物のキャラクターが別々のIPとして扱われてしまう（例：SaberがFate/ZeroとFate/Stay Nightの両方に属するなど）場合に対応できない。

### 目的

スキーマを改善し、IPとキャラクターの中間テーブルを追加することで、多対多の結びつけを可能にする。

---

## 2. 技術仕様

### 2.1 `ips_mapping` APIレスポンス形式

> [!IMPORTANT]
> Python AIサービス (`docs/design/python-ai-service.md`) の `/tag` エンドポイントは以下の形式を返す:
> 
> ```json
> {
>   "ips_mapping": {
>     "hatsune_miku": ["vocaloid", "character_vocal_series"]
>   }
> }
> ```
> 
> **形式**: `{ character_name: [ip_names] }` (キャラクター名がキー、IP名のリストが値)

### 2.2 データベーススキーマ (`apps/server/src/infrastructure/db/schema.ts`)

1.  **新規テーブル追加**: `character_ips` (中間テーブル)
    *   `character_id`: UUID (FK -> characters.id)
    *   `ip_id`: UUID (FK -> ips.id)
    *   `source`: text (default: "manual") - 手動かAI自動付与かを区別
    *   Primary Key: (`character_id`, `ip_id`)

2.  **カラム削除**: `characters` テーブル
    *   `ip_id` カラムを削除。

### 2.3 同名キャラクターの扱い

> [!WARNING]
> **破壊的変更**: 現在の `characters` テーブルには `(name, ip_id)` のユニーク制約がある。
> `ip_id` 削除後は、同名キャラクターを区別する方法が変わる。

**対応方針**: 

| パターン | 現在の扱い | 変更後の扱い |
|----------|------------|--------------|
| 同名・同IP | 1レコード | 1レコード |
| 同名・別IP | 別レコード | **1レコードに統合** |

- 例: 「artoria_pendragon」が Fate/Zero と Fate/stay night の両方に属する場合
  - 現在: 2つの別キャラクターレコード
  - 変更後: 1つのキャラクターレコード + `character_ips` で複数IPに紐づけ

**マイグレーション時の対応**:
- 同名キャラクターは統合し、`aliases` フィールドに元の情報を保持

### 2.4 データ構造体・型定義

*   DrizzleのSchema変更に伴い、`Character`型、`NewCharacter`型定義から `ipId` を削除。
*   `Character` エンティティ取得時は `character_ips` を介して `ips` を取得するようにリレーション定義を更新。

---

## 3. 移行プロセス (Migration)

既存のDBスキーマ更新だけでは、`ip_id` カラムのデータを中間テーブルに移行する際にデータ損失のリスクがあること、またユーザー指示により「JSONバックアップを用いた移行」を行う。

### Phase 1: バックアップ機能の拡張 (`apps/server/src/application/services/backup-service.ts`)

現在のJSONバックアップ（`createDump`）は、キャラクターとIPの結びつきを明示的に保持していない。

**Export処理の修正** (`_transformMediaList`):

```typescript
const simpleCharacters = media.characters.map((mc: any) => ({
  name: mc.character.name,
  description: mc.character.description,
  confidence: mc.confidence,
  // 追加: キャラクターに紐づくIP名を含める
  linkedIps: mc.character.ipId 
    ? [getIpNameById(mc.character.ipId)] 
    : [],
}));
```

### Phase 2: データバックアップ

1.  修正した `BackupService` を用いて、全データのJSONダンプを作成する。

### Phase 3: スキーマ変更とロジック修正

1.  **DBスキーマ変更**: `schema.ts` を修正し、マイグレーションを実行（`drizzle-kit generate` & `migrate`）。
    *   この時点で既存の `ip_id` データは削除される（Phase 2のバックアップで保全済み）。

2.  **Import処理の修正** (`_restoreRelations`):
    *   JSON内の `linkedIps` 情報を読み取り、新設した `character_ips` テーブルにレコードを挿入するロジックを追加する。
    *   多対多（1つのキャラクターに複数のIP）の登録に対応させる。

### Phase 4: データリストア

1.  DBをリセット（またはテーブル再作成）。
2.  Phase 2で作成したJSONからリストアを実行し、新スキーマへデータを移行する。

---

## 4. AI Taggingロジックの改修 (`apps/server/src/application/services/tagging-service.ts`)

### 4.1 現状の問題点

`TaggingService.saveTags` のコメントに誤りがある:

```typescript
// 誤: ips_mapping: { charName: [ipName] } - Note: The key is character name...
// 正: ips_mapping: { character_name: [ip_names] }
```

実際の形式はコメント通りだが、処理ロジックが1対1前提になっている。

### 4.2 修正内容

**保存ロジック (`saveTags`) の変更**:

```typescript
// 変更前: 最初の1つのIPのみを保存
for (const linkedIpName of linkedIpNames) {
  const ipId = ipNameIdMap.get(linkedIpName);
  if (ipId) {
    charToIpMap.set(charName, ipId);
    break; // ← 最初のIPのみ
  }
}

// 変更後: 全てのIPを character_ips テーブルに保存
for (const linkedIpName of linkedIpNames) {
  const ipId = ipNameIdMap.get(linkedIpName);
  if (ipId) {
    await this.characterIpRepo.link(charId, ipId, "AI");
  }
}
```

---

## 5. フロントエンド・API影響

> [!NOTE]
> 以下のコンポーネントに影響がある。

### 5.1 API レスポンス変更

| エンドポイント | 変更内容 |
|----------------|----------|
| `GET /media/:id` | `character.ipId` → `character.ips[]` |
| `GET /characters/:id` | `ipId` → `ips[]` |
| `POST /characters` | `ipId` パラメータ削除、`ipIds[]` 追加 |

### 5.2 UI 変更

- **キャラクター詳細画面**: 単一IP表示 → 複数IP表示（タグ形式）
- **キャラクター編集画面**: IP選択ドロップダウン → マルチセレクト

---

## 6. 作業手順まとめ

| # | 作業内容 | ファイル |
|---|----------|----------|
| 1 | `BackupService` の Export ロジック改修（`linkedIps`対応） | `backup-service.ts` |
| 2 | 全データのバックアップ取得 | - |
| 3 | `character_ips` テーブル定義追加 | `schema.ts` |
| 4 | `characters.ip_id` カラム削除 | `schema.ts` |
| 5 | マイグレーションファイル生成 | `drizzle-kit generate` |
| 6 | `BackupService` の Import ロジック改修 | `backup-service.ts` |
| 7 | `TaggingService` のロジック改修（多対多対応） | `tagging-service.ts` |
| 8 | `CharacterRepository` の更新 | `character-repository.ts` |
| 9 | API スキーマ更新 | 各ルーター |
| 10 | フロントエンド更新 | 各コンポーネント |
| 11 | バックアップ → スキーマ適用 → リストア のテスト | - |

---

## 7. テスト計画

### 7.1 ユニットテスト

- [ ] `TaggingService.saveTags` が複数IPを正しく保存する
- [ ] `BackupService._transformMediaList` が `linkedIps` を出力する
- [ ] `BackupService._restoreRelations` が `character_ips` にデータを挿入する

### 7.2 統合テスト

- [ ] 同名キャラクターのマイグレーションが正しく動作する
- [ ] AI タギング結果が複数IPに正しく紐づく

### 7.3 E2Eテスト

- [ ] キャラクター詳細画面で複数IPが表示される
- [ ] キャラクター編集画面で複数IP選択が可能
