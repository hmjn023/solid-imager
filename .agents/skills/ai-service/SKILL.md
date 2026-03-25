---
name: ai-service
description: 画像の自動タグ付け、類似度計算、CCIP特徴量などのAI機能の利用と Python AI サービス（src-python/main.py）の管理。AI サービスへの API リクエストの実装や、Python サーバーの起動方法、ベクトル検索機能（SimilarSearch）の調整を行う際に使用してください。
---

# Python AI Service スキル

## Working Rules

### Python AIサービスの起動

画像タグ付けや類似度計算などのAI機能を使用する場合は、Python AIサービスを起動してください。

```bash
uv run uvicorn src-python.main:app --host 0.0.0.0 --port 8000
```

サービスは `http://localhost:8000` で起動します。

### 提供される機能
- 画像の自動タグ付け (キャラクター、IP、一般タグ)
- CCIP (Content-based Copy-detection via Image Perceptual hashing) 特徴量抽出
- 画像間の類似度計算

### Python AI サービス連携ルール
- Python AIサービスへの呼び出しは `apps/server/src/application/services/tagging-service.ts` を経由します
- 直接 HTTP リクエストを送信せず、必ずサービス層を通してください

詳細は `docs/design/python-ai-service.md` を参照してください。

## Task Routing

| ユーザーの意図 | やること |
|---|---|
| AIサービス起動 | `uv run uvicorn src-python.main:app --host 0.0.0.0 --port 8000` |
| タグ付け機能の実装 | `tagging-service.ts` を経由してAIサービスを呼び出し |
| 類似度計算 | CCIP特徴量を使用したサービス層の実装 |
