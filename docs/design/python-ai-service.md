# Python AI サービス

## 概要

Python AI サービスは、**FastAPI** で構築されたマイクロサービスで、画像分析とAI機能を提供します。Node.js/Bun 環境では実行が困難なPython専用のAI/MLライブラリ（ONNX Runtime、画像処理ライブラリなど）を活用しています。

### 提供機能

1. **画像タグ付け**: PixAI モデルを使用した自動タグ生成（一般タグ、キャラクター、IP）
2. **CCIP 特徴量抽出**: 画像のperceptual hash（知覚的ハッシュ）を計算
3. **類似度計算**: 2つの画像の類似度を CCIP 特徴量から算出

---

## アーキテクチャ

```
┌─────────────────────────────────────────────────────────────┐
│                    Node.js/Bun Backend                      │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  TaggingService (TypeScript)                         │  │
│  │  src/application/services/tagging-service.ts         │  │
│  │  ┌────────────────────────────────────────────────┐  │  │
│  │  │  getTags()                                     │  │  │
│  │  │  getCcipFeature()                              │  │  │
│  │  │  getCcipDifference()                           │  │  │
│  │  └────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────┘  │
│                           ↓ HTTP                           │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│               Python AI Service (FastAPI)                   │
│                   src-python/main.py                        │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  POST /tag                                           │  │
│  │  POST /ccip/feature                                  │  │
│  │  POST /ccip/difference                               │  │
│  │  GET /health                                         │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  dghs-imgutils                                       │  │
│  │  ├── get_pixai_tags() (画像タグ付け)                 │  │
│  │  ├── ccip_extract_feature() (特徴量抽出)             │  │
│  │  └── ccip_difference() (類似度計算)                  │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  ONNX Runtime (推論エンジン)                          │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 技術スタック

### ランタイム・フレームワーク

- **Python**: 3.13+
- **FastAPI**: 0.115.0+ (高速な非同期Webフレームワーク)
- **Uvicorn**: 0.32.0+ (ASGIサーバー)

### AI/MLライブラリ

- **dghs-imgutils**: 0.19.0+ (画像タグ付け、CCIP計算)
- **ONNX Runtime**: 1.23.2+ (機械学習モデルの推論)
- **Pillow (PIL)**: 画像読み込み・変換

### 依存関係管理

- **uv**: 高速なPythonパッケージマネージャー（Rustで実装）

---

## セットアップ

### 1. Python 3.13+ のインストール

```bash
# mise を使用する場合
mise install python@3.13

# または pyenv を使用
pyenv install 3.13.0
pyenv local 3.13.0
```

### 2. 依存関係のインストール

`uv` を使用して依存関係をインストールします。

```bash
# uv がインストールされていない場合
curl -LsSf https://astral.sh/uv/install.sh | sh

# 依存関係のインストール（プロジェクトルートで実行）
uv sync
```

**依存関係** (`pyproject.toml`):
```toml
[project]
name = "solid-imager"
requires-python = ">=3.13"
dependencies = [
    "dghs-imgutils>=0.19.0",
    "fastapi>=0.115.0",
    "uvicorn>=0.32.0",
    "python-multipart>=0.0.12",
    "onnxruntime>=1.23.2",
]
```

### 3. サービスの起動

```bash
# プロジェクトルートで実行
bun run ai:start

# または直接 uv で起動
uv run uvicorn src-python.main:app --reload --port 8000
```

サービスは `http://localhost:8000` で起動します。

### 4. ヘルスチェック

```bash
curl http://localhost:8000/health
```

**レスポンス例**:
```json
{
  "status": "ok",
  "models_warmed_up": true
}
```

---

## API エンドポイント

### 1. `GET /health`

サービスの状態とモデルのウォームアップ状態を確認します。

**リクエスト例**:
```bash
curl http://localhost:8000/health
```

**レスポンス**:
```json
{
  "status": "ok",
  "models_warmed_up": true
}
```

---

### 2. `POST /tag` - 画像タグ付け

画像から一般タグ、キャラクター、IP（作品）を自動抽出します。

#### リクエスト

**方法1: ファイルアップロード**

```bash
curl -X POST http://localhost:8000/tag \
  -F "file=@/path/to/image.png"
```

**方法2: ファイルパス指定** (ローカルファイルシステムのみ)

```bash
curl -X POST http://localhost:8000/tag \
  -F "path=/absolute/path/to/image.png"
```

#### レスポンス

```json
{
  "general": {
    "1girl": 0.95,
    "solo": 0.92,
    "long_hair": 0.88,
    "blue_eyes": 0.85,
    "smile": 0.80
  },
  "character": {
    "hatsune_miku": 0.98,
    "miku_(vocaloid)": 0.95
  },
  "ips": [
    "vocaloid",
    "character_vocal_series"
  ],
  "ips_mapping": {
    "hatsune_miku": ["vocaloid", "character_vocal_series"]
  }
}
```

#### TypeScript での使用例

```typescript
import { taggingService } from "~/application/services/tagging-service";

// バッファから取得
const tags = await taggingService.getTags(imageBuffer);

// メディアIDから取得
const tags = await taggingService.getTagsForMedia(sourceId, mediaId);

console.log(tags.general); // { "1girl": 0.95, ... }
console.log(tags.character); // { "hatsune_miku": 0.98, ... }
console.log(tags.ips); // ["vocaloid", ...]
```

---

### 3. `POST /ccip/feature` - CCIP 特徴量抽出

画像のperceptual hash（知覚的ハッシュ）を計算します。CCIP (Content-based Copy-detection via Image Perceptual hashing) は、画像の視覚的特徴を数値ベクトルとして表現します。

#### リクエスト

**方法1: ファイルアップロード**

```bash
curl -X POST http://localhost:8000/ccip/feature \
  -F "file=@/path/to/image.png"
```

**方法2: ファイルパス指定**

```bash
curl -X POST http://localhost:8000/ccip/feature \
  -F "path=/absolute/path/to/image.png"
```

#### レスポンス

```json
{
  "feature": [
    0.123, 0.456, 0.789, ..., -0.234
  ]
}
```

**特徴量ベクトル**:
- 次元数: 512次元（固定）
- 値の範囲: -1.0 〜 1.0
- 用途: 類似画像検索、重複検出

#### TypeScript での使用例

```typescript
import { taggingService } from "~/application/services/tagging-service";

// 特徴量を抽出
const { feature } = await taggingService.getCcipFeatureForMedia(sourceId, mediaId);

// データベースに保存
await db.update(mediaTechnicalInfo).set({
  ccipFeature: feature, // number[] として保存
}).where(eq(mediaTechnicalInfo.mediaId, mediaId));
```

---

### 4. `POST /ccip/difference` - 類似度計算

2つの画像の CCIP 特徴量から類似度を計算します。

#### リクエスト

```bash
curl -X POST http://localhost:8000/ccip/difference \
  -H "Content-Type: application/json" \
  -d '{
    "feature1": [0.123, 0.456, ...],
    "feature2": [0.125, 0.450, ...]
  }'
```

#### レスポンス

```json
{
  "difference": 0.0234
}
```

**類似度の解釈**:
- `0.0`: 完全に同一
- `0.0 - 0.1`: 非常に類似（ほぼ同じ画像）
- `0.1 - 0.3`: 類似（同じシーンの別バージョンなど）
- `0.3 - 0.5`: やや類似（同じキャラクター、別ポーズなど）
- `0.5+`: 異なる画像

#### TypeScript での使用例

```typescript
import { taggingService } from "~/application/services/tagging-service";

// 2つの画像の類似度を計算
const difference = await taggingService.getCcipDifference(feature1, feature2);

if (difference < 0.1) {
  console.log("これらの画像は非常に類似しています");
} else if (difference < 0.3) {
  console.log("これらの画像は類似しています");
} else {
  console.log("これらの画像は異なります");
}
```

---

## Node.js側からの呼び出し

### TaggingService の使用

Python AI サービスへの呼び出しは、必ず `TaggingService` を経由します。直接HTTPリクエストを送信しないでください。

**場所**: `src/application/services/tagging-service.ts`

#### 使用例

```typescript
import { taggingService } from "~/application/services/tagging-service";

// 1. サービスの稼働確認
const isAvailable = await taggingService.isServiceAvailable();
if (!isAvailable) {
  console.error("Python AI service is not available");
  return;
}

// 2. 画像のタグ付け（バッファから）
const imageBuffer = await fetch(imageUrl).then(r => r.arrayBuffer());
const tags = await taggingService.getTags(imageBuffer);

// 3. 画像のタグ付け（メディアIDから）
const tags = await taggingService.getTagsForMedia(sourceId, mediaId);

// 4. CCIP特徴量の抽出
const { feature } = await taggingService.getCcipFeatureForMedia(sourceId, mediaId);

// 5. 類似度の計算
const difference = await taggingService.getCcipDifference(feature1, feature2);
```

### oRPC エンドポイントでの使用

**場所**: `src/infrastructure/api/routers/ai-router.ts`

```typescript
import { os } from "@orpc/server";
import { z } from "zod";
import { taggingService } from "~/application/services/tagging-service";

export const aiRouter = {
  /**
   * 画像をタグ付け
   */
  tag: os
    .input(
      z.union([
        z.object({ file: z.instanceof(File) }),
        z.object({ mediaSourceId: z.string(), mediaId: z.string() }),
      ])
    )
    .handler(async ({ input }) => {
      if ("file" in input) {
        const buffer = await input.file.arrayBuffer();
        return await taggingService.getTags(buffer);
      }

      const { mediaSourceId, mediaId } = input;
      return await taggingService.getTagsForMedia(mediaSourceId, mediaId);
    }),

  /**
   * CCIP特徴量を抽出
   */
  ccipFeature: os
    .input(
      z.union([
        z.object({ file: z.instanceof(File) }),
        z.object({ mediaSourceId: z.string(), mediaId: z.string() }),
      ])
    )
    .handler(async ({ input }) => {
      if ("file" in input) {
        const buffer = await input.file.arrayBuffer();
        return await taggingService.getCcipFeature(buffer);
      }

      const { mediaSourceId, mediaId } = input;
      return await taggingService.getCcipFeatureForMedia(mediaSourceId, mediaId);
    }),

  /**
   * 2つの特徴量の類似度を計算
   */
  ccipDifference: os
    .input(
      z.object({
        feature1: z.array(z.number()),
        feature2: z.array(z.number()),
      })
    )
    .handler(async ({ input }) => {
      const difference = await taggingService.getCcipDifference(
        input.feature1,
        input.feature2
      );
      return { difference };
    }),
};
```

---

## モデルのウォームアップ

Python AI サービスは起動時に自動的にモデルをウォームアップします。これにより、最初のリクエストも高速に処理できます。

### ウォームアップ処理

**場所**: `src-python/main.py`

```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifespan context manager to handle startup and shutdown events.
    We use this to warm up the models.
    """
    global MODELS_WARMED_UP
    logger.info("Starting up AI Service...")
    
    try:
        # Warm up PixAI tagging model
        logger.info("Warming up PixAI tagging model...")
        dummy_image = Image.new('RGB', (448, 448), color='white')
        get_pixai_tags(dummy_image)
        
        # Warm up CCIP model
        logger.info("Warming up CCIP model...")
        ccip_extract_feature(dummy_image)
        
        MODELS_WARMED_UP = True
        logger.info("All models warmed up successfully!")
    except Exception as e:
        logger.error(f"Error during model warm-up: {e}")
    
    yield
    
    logger.info("Shutting down AI Service...")

app = FastAPI(lifespan=lifespan)
```

### ウォームアップの確認

```bash
curl http://localhost:8000/health
```

`models_warmed_up: true` が返されれば、モデルは準備完了です。

---

## パフォーマンス最適化

### 1. ローカルファイルパスの使用

ファイルアップロードよりも**ローカルファイルパス**を指定する方が高速です（ネットワーク転送が不要）。

```typescript
// ✅ Good: ローカルパスを直接指定（高速）
const tags = await taggingService.getTagsForMedia(sourceId, mediaId);

// ❌ Slow: バッファをアップロード（ネットワーク転送が発生）
const buffer = await fetch(url).then(r => r.arrayBuffer());
const tags = await taggingService.getTags(buffer);
```

### 2. バッチ処理

複数の画像を処理する場合は、並列処理を活用します。

```typescript
const mediaIds = ["id1", "id2", "id3", ...];

// 並列処理
const results = await Promise.all(
  mediaIds.map(mediaId => 
    taggingService.getTagsForMedia(sourceId, mediaId)
  )
);
```

### 3. キャッシュの活用

一度計算したタグや特徴量はデータベースに保存し、再利用します。

```typescript
// データベースに保存
await db.insert(mediaTags).values(
  tags.general.map(tag => ({
    mediaId,
    tagName: tag.name,
    confidence: tag.score,
  }))
);

// 次回は DB から取得
const cachedTags = await db.select().from(mediaTags).where(eq(mediaTags.mediaId, mediaId));
```

---

## トラブルシューティング

### 1. サービスが起動しない

**原因**: Python 3.13+ がインストールされていない

**解決策**:
```bash
mise install python@3.13
# または
pyenv install 3.13.0
```

### 2. "ModuleNotFoundError: No module named 'dghs_imgutils'"

**原因**: 依存関係がインストールされていない

**解決策**:
```bash
uv sync
```

### 3. "Connection refused" エラー

**原因**: Python AI サービスが起動していない

**解決策**:
```bash
bun run ai:start
```

### 4. モデルのダウンロードが遅い

**原因**: 初回起動時に ONNX モデルがダウンロードされる

**解決策**: 初回起動時は数分かかります。以降はキャッシュが使用されます。

```bash
# モデルのキャッシュ場所
~/.cache/huggingface/
```

### 5. メモリ不足エラー

**原因**: ONNX Runtime が大量のメモリを使用

**解決策**: サーバーのメモリを増やすか、処理する画像のサイズを制限します。

```python
# 画像サイズを制限
if image.width > 2048 or image.height > 2048:
    image.thumbnail((2048, 2048), Image.LANCZOS)
```

---

## 開発ガイド

### 新しいエンドポイントの追加

1. **Python側**: `src-python/main.py` にエンドポイントを追加

```python
@app.post("/new-endpoint")
async def new_feature(file: UploadFile = File(...)):
    image = load_image(file, None)
    # 処理を実装
    return {"result": "success"}
```

2. **TypeScript側**: `src/application/services/tagging-service.ts` にメソッド追加

```typescript
async getNewFeature(imageBuffer: ArrayBuffer): Promise<NewFeatureResponse> {
  return await this.aiClient.callNewFeature(imageBuffer);
}
```

3. **インターフェース更新**: `src/domain/interfaces/ai-client.ts`

```typescript
export interface IAiClient {
  // 既存のメソッド
  callNewFeature(imageBuffer: ArrayBuffer): Promise<NewFeatureResponse>;
}
```

4. **クライアント実装**: `src/infrastructure/ai/python-ai-client.ts`

```typescript
async callNewFeature(imageBuffer: ArrayBuffer): Promise<NewFeatureResponse> {
  const formData = new FormData();
  formData.append("file", new Blob([imageBuffer]));
  
  const response = await fetch(`${this.baseUrl}/new-endpoint`, {
    method: "POST",
    body: formData,
  });
  
  return await response.json();
}
```

### ログの確認

```bash
# Python AI サービスのログ
bun run ai:start

# 詳細ログ（デバッグモード）
LOG_LEVEL=DEBUG bun run ai:start
```

---

## まとめ

Python AI サービスは、solid-imager の AI 機能を支える重要なコンポーネントです。

**重要なポイント**:
1. ✅ `bun run ai:start` でサービスを起動
2. ✅ 必ず `TaggingService` 経由で呼び出す
3. ✅ ローカルファイルパスの使用で高速化
4. ✅ モデルのウォームアップを確認
5. ✅ タグと特徴量は DB にキャッシュ

詳細な API 仕様は [FastAPI Docs](http://localhost:8000/docs) を参照してください（サービス起動時）。
