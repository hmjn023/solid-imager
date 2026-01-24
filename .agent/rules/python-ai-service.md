---
trigger: model_decision
description: 画像の自動タグ付け、類似度計算、CCIP特徴量などのAI機能を利用する機能の実装や、Python AIサービスの起動方法について確認が必要な場合に参照してください。
---

### Python AIサービスの起動

画像タグ付けや類似度計算などのAI機能を使用する場合は、Python AIサービスを起動してください。

```bash
bun run ai:start
```

サービスは `http://localhost:8000` で起動します。

**提供される機能:**
- 画像の自動タグ付け (キャラクター、IP、一般タグ)
- CCIP (Content-based Copy-detection via Image Perceptual hashing) 特徴量抽出
- 画像間の類似度計算

詳細は [Python AIサービスドキュメント](./docs/design/python-ai-service.md) を参照してください。

#### Python AI サービス連携ルール

-   Python AIサービスへの呼び出しは `src/application/services/tagging-service.ts` を経由します。
-   直接 HTTP リクエストを送信せず、必ずサービス層を通してください。