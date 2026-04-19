# Track: xtracterスキーマのBackupService準拠化と共通化

## 概要

ブラウザ拡張機能 `xtracter` からサーバーに送信されるデータ構造を、サーバー側の `BackupService` で使用されているバックアップ（ダンプ）形式のスキーマに準拠させます。さらに、バックアップ用スキーマを共通定義として切り出し、ダウンロード用スキーマがそれを拡張（継承）する構成にリファクタリングすることで、両者の構造的整合性を保証します。

## 現状の課題

- `xtracter` が独自のフラットなスキーマを使用しており、サーバー側のデータ構造と乖離している。
- バックアップ機能（ダンプ/リストア）とダウンロード機能で、実質的に同じデータを扱っているにも関わらず、型定義やバリデーションが共有されていない。

## 変更仕様

### 1. スキーマ構成の刷新 (`src/domain/media/schemas.ts`)

#### A. 基底スキーマ: `mediaDumpItemSchema`

`BackupService` が生成・消費するJSONダンプの1レコード分の定義。

```typescript
const mediaDumpItemSchema = z.object({
  // 基本情報
  id: z.string().optional(), // インポート時は無視/新規生成
  filePath: z.string().optional(),
  fileName: z.string().optional(),
  description: z.string().nullable().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  fileSize: z.number().optional(),
  mediaType: z.enum(["image", "video", "audio"]).optional(), // バリデーション時は必須にしたいが、部分入力も考慮
  createdAt: z.coerce.date().optional(),
  modifiedAt: z.coerce.date().optional(),

  // リレーション
  sourceUrls: z.array(z.string().url()).optional(),
  authors: z.array(z.object({
    name: z.string(),
    accountId: z.string().nullable().optional(),
  })).optional(),
  tags: z.array(z.object({
    name: z.string(),
    type: z.enum(["positive", "negative"]).optional(),
  })).optional(),
  characters: z.array(z.object({
    name: z.string(),
    description: z.string().nullable().optional(),
  })).optional(),
  ips: z.array(z.object({
    name: z.string(),
    description: z.string().nullable().optional(),
  })).optional(),
  projects: z.array(z.object({
    name: z.string(),
    description: z.string().nullable().optional(),
  })).optional(),
  generationInfo: z.object({ ... }).nullable().optional(),
});
```

#### B. 拡張スキーマ: `downloadItemSchema`

`xtracter` からの入力用。基底スキーマを継承し、ダウンロード実行に必要な情報を追加。

```typescript
const downloadItemSchema = mediaDumpItemSchema.extend({
	// ダウンロード特有の必須項目
	targetUrl: z.string().url(), // 実際にダウンロードするリソースのURL

	// 技術的オプション
	cookies: z.array(z.any()).optional(),
	userAgent: z.string().optional(),
});
```

### 2. 影響範囲と変更点

#### A. Backend (`solid-imager`)

- **Schema**: 上記の通り `src/domain/media/schemas.ts` を再構築。
- **BackupService**: `src/application/services/backup-service.ts` を修正し、リストア時のバリデーション等に `mediaDumpItemSchema` (またはその型) を利用するよう調整（既存ロジックとの兼ね合いを見つつ）。
- **Job**: `src/infrastructure/jobs/download-jobs.ts` を更新。フラットなプロパティへのアクセスを、ネストされたプロパティへのアクセスに変更。

#### B. Frontend / Extension (`xtracter`)

- **Types**: `xtracter/src/types.ts` を更新し、バックアップ互換の型定義にする。
- **Content Script**: データ抽出ロジックを更新し、`authors` 配列や `sourceUrls` 配列を作成して送信するように変更。

## 完了条件

1.  `src/domain/media/schemas.ts` に共通の基底スキーマと、それを拡張したダウンロード用スキーマが定義されていること。
2.  `xtracter` が新スキーマ形式でリクエストを送信できること。
3.  サーバー側でダウンロードが正常に機能し、メタデータが正しく保存されること。
4.  （可能であれば）BackupServiceの一部でもこの型定義が参照され、整合性が意識されていること。
