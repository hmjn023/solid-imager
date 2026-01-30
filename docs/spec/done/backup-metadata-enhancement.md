# バックアップメタデータ拡張仕様

## 概要

バックアップJSONに、IP、キャラクター、タグの起源（source）とconfidence情報を追加し、リストア時に完全な情報を復元できるようにする。

## 背景

現在のバックアップJSONには以下の問題がある:

1. **タグのsource情報が欠落**: AIタグか手動タグかを区別できない
2. **IP/キャラクターのsource情報が欠落**: 起源情報が失われる
3. **confidence情報の不完全性**: 一部のエンティティでconfidenceが保存されていない

これにより、リストア後にメタデータの正確性が損なわれる。

## 要件

### 機能要件

#### FR-1: タグのsource保存
- バックアップJSON内のタグに`source`フィールドを追加
- 値: `"AI"`, `"manual"`, `"comfyui_workflow"`, `"restored"`など
- リストア時に元のsourceを復元

#### FR-2: IP/キャラクターのsource保存
- バックアップJSON内のIP、キャラクターに`source`フィールドを追加
- 値: `"AI"`, `"manual"`, `"restored"`など
- リストア時に元のsourceを復元

#### FR-3: confidence情報の完全保存
- すべてのエンティティでconfidence値を保存
- タグ、キャラクター、IP（メディアとの関連）のconfidenceを含む

### 非機能要件

#### NFR-1: 後方互換性
- 古いバックアップJSON（sourceフィールドなし）も読み込み可能
- sourceがない場合はデフォルト値`"restored"`を使用

#### NFR-2: データ整合性
- リストア後のデータが元のデータと完全に一致すること
- source情報の欠落や誤った値の設定がないこと

## 設計

### スキーマ変更

#### mediaMetadataContextSchema (schemas.ts)

```typescript
export const mediaMetadataContextSchema = z.object({
  // ... 既存フィールド
  tags: z.array(
    z.object({
      name: z.string(),
      type: z.enum(["positive", "negative"]).optional(),
      confidence: z.number().optional(),
      source: z.string().optional(), // ← 追加
    })
  ).optional(),
  characters: z.array(
    z.object({
      name: z.string(),
      description: z.string().nullable().optional(),
      confidence: z.number().optional(),
      linkedIps: z.array(z.string()).optional(),
      source: z.string().optional(), // ← 追加
    })
  ).optional(),
  ips: z.array(
    z.object({
      name: z.string(),
      description: z.string().nullable().optional(),
      confidence: z.number().optional(), // ← 追加
      source: z.string().optional(), // ← 追加
    })
  ).optional(),
});
```

### バックアップ処理の変更

#### _transformMediaList (backup-service.ts)

**変更箇所**: エクスポート時にsource情報を含める

```typescript
// タグ
const simpleTags = media.tags.map((mt) => ({
  name: mt.tag.name,
  type: mt.tagType,
  confidence: mt.confidence,
  source: mt.source, // ← 追加
}));

// キャラクター
const simpleCharacters = media.characters.map((mc) => ({
  name: mc.character.name,
  description: mc.character.description,
  confidence: mc.confidence,
  linkedIps: mc.character.ips?.map((ci) => ci.ip.name),
  source: mc.source, // ← 追加
}));

// IP
const simpleIps = media.ips.map((mi) => ({
  name: mi.ip.name,
  description: mi.ip.description,
  confidence: mi.confidence, // ← 追加
  source: mi.source, // ← 追加
}));
```

### リストア処理の変更

#### _restoreRelations (backup-service.ts)

**変更箇所**: インポート時にsource情報を復元

```typescript
// タグ
if (item.tags) {
  for (const t of item.tags) {
    const tagId = t.name ? tagMap.get(t.name) : undefined;
    if (tagId) {
      mediaTagsData.push({
        mediaId,
        tagId,
        tagType: (t.type === "positive" || t.type === "negative"
          ? t.type
          : "positive") as "positive" | "negative",
        confidence: t.confidence ?? null,
        source: t.source || "restored", // ← sourceを使用
      });
    }
  }
}

// キャラクター
if (item.characters) {
  for (const c of item.characters) {
    const charId = c.name ? charMap.get(c.name) : undefined;
    if (charId) {
      mediaCharsData.push({
        mediaId,
        characterId: charId,
        confidence: c.confidence ?? null,
        source: c.source || "restored", // ← sourceを使用
      });
      // ... IP紐付け処理
    }
  }
}

// IP
if (item.ips) {
  for (const i of item.ips) {
    const ipId = i.name ? ipMap.get(i.name) : undefined;
    if (ipId) {
      mediaIpsData.push({
        mediaId,
        ipId,
        confidence: i.confidence ?? null, // ← confidenceを使用
        source: i.source || "restored", // ← sourceを使用
      });
    }
  }
}
```

## 実装計画

### フェーズ1: スキーマ更新（優先度: 高）
1. `schemas.ts`の`mediaMetadataContextSchema`を更新
2. 型定義の更新

### フェーズ2: バックアップ処理更新（優先度: 高）
1. `_transformMediaList`でsource情報をエクスポート
2. 既存のバックアップとの互換性テスト

### フェーズ3: リストア処理更新（優先度: 高）
1. `_restoreRelations`でsource情報をインポート
2. デフォルト値の設定（`"restored"`）

### フェーズ4: テスト（優先度: 高）
1. 新しいバックアップ→リストアのテスト
2. 古いバックアップ→リストアの互換性テスト
3. source値の正確性検証

## テストケース

### TC-1: 新しいバックアップからのリストア
- **前提**: source情報を含むバックアップJSON
- **期待**: すべてのsource情報が正しく復元される

### TC-2: 古いバックアップからのリストア
- **前提**: sourceフィールドがないバックアップJSON
- **期待**: デフォルト値`"restored"`が設定される

### TC-3: AIタグの保存と復元
- **前提**: AIタグ（source="AI"）を含むメディア
- **期待**: バックアップ→リストア後もsource="AI"が維持される

### TC-4: 手動タグの保存と復元
- **前提**: 手動タグ（source="manual"）を含むメディア
- **期待**: バックアップ→リストア後もsource="manual"が維持される

## マイグレーション戦略

### 既存データへの影響
- **データベース**: 変更なし（既にsourceフィールドは存在）
- **バックアップJSON**: 新しいフィールドが追加されるが、古いJSONも読み込み可能

### 推奨手順
1. 本番環境に適用する前に、現在のDBから完全なバックアップを取得
2. スキーマ更新をデプロイ
3. 新しいバックアップを取得（source情報を含む）
4. テスト環境でリストアを検証
5. 本番環境に適用

## リスクと対策

### リスク1: 古いバックアップの互換性
- **対策**: sourceフィールドをoptionalにし、デフォルト値を設定

### リスク2: source値の不整合
- **対策**: バリデーションを追加し、不正な値を検出

### リスク3: パフォーマンス影響
- **対策**: バックアップサイズの増加は微小（フィールド1つ分）、影響は軽微

## 参考資料

- [データベース設計](../design/database-design.md)
- [API設計](../design/api-design.md)
- [アーキテクチャ](../architecture/ARCHITECTURE.md)
