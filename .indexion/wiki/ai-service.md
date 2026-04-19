# AIサービス連携

`src-python/` に FastAPI で実装されたローカルAI解析サービス。画像タグ付けとキャラクター認識を担う。

## 起動

```bash
cd src-python
uv sync          # または pip install -e .
uvicorn main:app --reload --port 8000
```

起動時にモデルをウォームアップする（初回リクエストの遅延を防ぐため）。ウォームアップに失敗してもサービスは起動するが、最初のリクエストが遅くなる。

## エンドポイント一覧

### `GET /health`

サービスの疎通確認とモデルのウォームアップ状態を返す。

```json
{ "status": "ok", "models_warmed_up": true }
```

### `POST /tag`

画像をタグ付けする。PixAIタガー（`dghs-imgutils`）を使用。

**リクエスト** (multipart/form-data):
- `file`: アップロードファイル（省略可）
- `path`: サーバー上のファイルパス（省略可）
- いずれか一方が必須

**レスポンス**:
```json
{
  "general": { "blue_eyes": 0.95, "long_hair": 0.87, ... },
  "character": { "hatsune_miku": 0.92, ... },
  "ips": ["vocaloid"],
  "ips_mapping": { "hatsune_miku": ["vocaloid"] }
}
```

- `general`: 汎用タグ → DB の `tags` テーブル（`tag_type: positive`）へ保存
- `character`: キャラクタータグ → `characters` テーブルへ
- `ips`: IP名リスト → `ips` テーブルへ
- `ips_mapping`: キャラクターとIPの対応関係

### `POST /ccip/feature`

画像からCCIP特徴量ベクトルを抽出する。キャラクター類似度比較に使用。

**リクエスト**: `/tag` と同様（`file` または `path`）

**レスポンス**:
```json
{ "feature": [0.12, -0.34, ...] }
```

### `POST /ccip/difference`

2つのCCIP特徴量ベクトル間の差異（距離）を計算する。

**リクエスト**:
```json
{ "feature1": [...], "feature2": [...] }
```

**レスポンス**:
```json
{ "difference": 0.23 }
```

差異が小さいほど類似キャラクター。

## serverからの呼び出し

`apps/server/src/infrastructure/api-clients/` に AIクライアントの実装。呼び出しフロー:

```
tagging-jobs.ts / tagging-service.ts
    ↓
AiApiClient（HTTP POST to /tag）
    ↓
src-python FastAPI
    ↓
結果をmedia_tags・media_characters・media_ipsに保存
```

CLIからは `imager-cli ai tag <mediaId>` で個別実行も可能。

## 使用ライブラリ

| ライブラリ | 用途 |
|---|---|
| `dghs-imgutils` | PixAI画像タガー・CCIP特徴量抽出 |
| `onnxruntime` | ONNXモデルの推論エンジン |
| `Pillow` | 画像読み込み・前処理 |
| `FastAPI` | HTTPサーバー |
| `pydantic` | レスポンスモデルバリデーション |

## 設定

AIサービスのURLは `apps/server/.env` の `AI_SERVICE_URL`（例: `http://localhost:8000`）で指定。未設定の場合はAI機能が無効化される。

## Tauri との関係

Tauri（デスクトップ版）でのAI処理は**server委譲が正**。Tauri standalone でAIを完結させる実装は当面 parity 対象外。
