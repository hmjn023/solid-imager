# 設定画面の実装状況調査レポート

## 調査概要

[`src/routes/config.tsx`](../../src/routes/config.tsx)で設定可能な値が、実際のアプリケーション動作にどの程度影響を与えているかを調査しました。

## 設定項目一覧

設定画面では以下の5つのカテゴリに分かれた設定項目があります:

### 1. Jobs 設定
- `jobs.concurrency` - 同時実行ジョブ数
- `jobs.pollIntervalMs` - ジョブポーリング間隔(ミリ秒)
- `jobs.enableAutoTagging` - 自動タグ付けの有効化

### 2. AI 設定
- `ai.baseUrl` - Python AIサービスのベースURL
- `ai.timeoutMs` - AIサービスのタイムアウト(ミリ秒)

### 3. Storage 設定
- `storage.thumbnailDir` - サムネイルディレクトリ
- `storage.thumbnailSize` - サムネイルサイズ(px)
- `storage.thumbnailQuality` - サムネイル品質(1-100)

### 4. Media 設定
- `media.supportedExtensions.image` - サポートする画像拡張子
- `media.supportedExtensions.video` - サポートする動画拡張子
- `media.supportedExtensions.audio` - サポートする音声拡張子
- `media.tagExtraction.comfyui.positiveNodeTypes` - ComfyUIのポジティブノードタイプ
- `media.tagExtraction.comfyui.negativeKeywords` - ネガティブキーワード
- `media.tagExtraction.comfyui.negativeTags` - ネガティブタグ

### 5. Logging 設定
- `logging.level` - ログレベル(trace/debug/info/warn/error/fatal)

---

## 実装状況の詳細

### ✅ **動作している設定**

#### Jobs: concurrency & pollIntervalMs

**保存場所:** `config.json`

**使用箇所:** [`src/infrastructure/jobs/job-worker.ts`](../../src/infrastructure/jobs/job-worker.ts)

**動作:** ✅ **完全に動作**

設定値は以下のように利用されています:

1. **初期化時:** [`src/infrastructure/bootstrap.ts:L43`](../../src/infrastructure/bootstrap.ts#L43)で`JobWorker`が設定値で初期化される
2. **動的更新:** [`src/infrastructure/bootstrap.ts:L44`](../../src/infrastructure/bootstrap.ts#L44)で`onChange`リスナーが登録され、設定変更時に自動的に`JobWorker`が更新される

```typescript
// bootstrap.ts
jobWorker.updateConfig(configService.get());
configService.onChange((config) => jobWorker.updateConfig(config));
```

**検証方法:**
- 設定画面でconcurrencyを変更すると、同時実行ジョブ数が実際に変更される
- pollIntervalMsを変更すると、ジョブのポーリング間隔が変更される

---

### ❌ **動作していない設定**

#### Jobs: enableAutoTagging

**保存場所:** `config.json`

**問題点:** ⚠️ **ハードコードされている**

[`src/application/services/media-processing-service.ts:L59`](../../src/application/services/media-processing-service.ts#L59)で`false`にハードコードされており、設定値が使用されていません:

```typescript
private readonly enableAutoTagging = false;
```

**影響:** 設定画面で有効化しても、自動タグ付けは実行されません。

---

#### AI: baseUrl & timeoutMs

**保存場所:** `config.json`

**問題点:** ⚠️ **ハードコードされている**

[`src/infrastructure/ai/python-client.ts:L14`](../../src/infrastructure/ai/python-client.ts#L14)でコンストラクタがデフォルト値`http://localhost:8000`を使用しており、設定値を参照していません:

```typescript
constructor(baseUrl = "http://localhost:8000") {
  this.baseUrl = baseUrl;
}
```

また、`timeoutMs`設定は全く使用されていません。

**影響:** 
- 設定画面でbaseURLを変更しても、AIサービスの接続先は変わりません
- タイムアウト設定は無視されます

---

#### Storage: thumbnailDir, thumbnailSize, thumbnailQuality

**保存場所:** `config.json`

**問題点:** ⚠️ **ハードコードされている**

[`src/infrastructure/jobs/thumbnails.ts`](../../src/infrastructure/jobs/thumbnails.ts)でサムネイル生成時の設定がハードコードされています:

- **thumbnailDir:** [L19](../../src/infrastructure/jobs/thumbnails.ts#L19) - `.cache/thumbnails`にハードコード
- **thumbnailSize:** [L15](../../src/infrastructure/jobs/thumbnails.ts#L15) - `512`にハードコード
- **thumbnailQuality:** [L16](../../src/infrastructure/jobs/thumbnails.ts#L16) - `80`にハードコード

```typescript
const DEFAULT_THUMBNAIL_SIZE = 512;
const DEFAULT_THUMBNAIL_QUALITY = 80;

export function getSourceCacheDir(mediaSourceId: string): string {
  return path.join(".cache/thumbnails", mediaSourceId);
}
```

**影響:** 設定画面で変更しても、サムネイルの保存先、サイズ、品質は変わりません。

---

#### Media: supportedExtensions & tagExtraction

**保存場所:** `config.json`

**問題点:** ⚠️ **ハードコードされている**

**supportedExtensions:**
- [`src/application/services/media-processing-service.ts:L85-L88`](../../src/application/services/media-processing-service.ts#L85-L88)でメディアタイプ判定がハードコードされています
  
```typescript
const ext = path.extname(relativePath).toLowerCase();
let mediaType: "image" | "video" | "audio" = "image";
if ([".mp4", ".webm", ".mov"].includes(ext)) {
  mediaType = "video";
} else if ([".mp3", ".wav"].includes(ext)) {
  mediaType = "audio";
}
```

**tagExtraction.comfyui:**
- [`src/domain/media/utils/metadata-utils.ts`](../../src/domain/media/utils/metadata-utils.ts)でタグ抽出ロジックが実装されていますが、設定値を参照していません

**影響:**
- 設定画面で拡張子を追加・削除しても、実際のメディア判定には反映されません
- ComfyUIのタグ抽出設定も無視されます

---

#### Logging: level

**保存場所:** `config.json`

**問題点:** ⚠️ **環境変数のみ参照**

[`src/infrastructure/logger.ts:L6`](../../src/infrastructure/logger.ts#L6)でログレベルは環境変数`LOG_LEVEL`から読み込まれており、設定ファイルの値は使用されていません:

```typescript
export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  // ...
});
```

**影響:** 設定画面でログレベルを変更しても、実際のログ出力レベルは変わりません。

---

## まとめ

### 📊 **実装状況サマリー**

| カテゴリ | 設定項目 | 状態 | 備考 |
|---------|---------|------|------|
| **Jobs** | `concurrency` | ✅ 動作 | onChange リスナーで動的更新される |
| **Jobs** | `pollIntervalMs` | ✅ 動作 | onChange リスナーで動的更新される |
| **Jobs** | `enableAutoTagging` | ❌ 未使用 | ハードコード: `false` |
| **AI** | `baseUrl` | ❌ 未使用 | ハードコード: `http://localhost:8000` |
| **AI** | `timeoutMs` | ❌ 未使用 | 実装なし |
| **Storage** | `thumbnailDir` | ❌ 未使用 | ハードコード: `.cache/thumbnails` |
| **Storage** | `thumbnailSize` | ❌ 未使用 | ハードコード: `512` |
| **Storage** | `thumbnailQuality` | ❌ 未使用 | ハードコード: `80` |
| **Media** | `supportedExtensions.*` | ❌ 未使用 | ハードコード |
| **Media** | `tagExtraction.comfyui.*` | ❌ 未使用 | 設定値未参照 |
| **Logging** | `level` | ❌ 未使用 | 環境変数 `LOG_LEVEL` のみ参照 |

### 🎯 **結論**

**動作している設定:** 15項目中 **2項目のみ** (約13%)

設定画面で設定可能な項目のうち、実際に動作しているのはJobsカテゴリの`concurrency`と`pollIntervalMs`のみです。これらは設定変更時に`onChange`リスナーを通じて動的に反映されます。

その他の設定項目はすべて以下のいずれかの状態です:
- **ハードコード:** コード内で固定値が使用されている
- **未実装:** 設定値を読み込む処理が存在しない
- **環境変数依存:** 設定ファイルではなく環境変数を参照している

### 💡 **推奨事項**

設定画面の機能を完全に有効化するには、以下の実装が必要です:

1. **各サービスで設定値を参照する実装を追加**
   - `PythonClient`でAI設定を使用
   - サムネイル生成でStorage設定を使用
   - メディア処理でMedia設定を使用
   
2. **設定変更リスナーの実装**
   - Jobsのように`onChange`リスナーを各サービスに実装
   
3. **ロガーの動的レベル変更**
   - `pino`のログレベルを動的に変更できるようにする
