---
name: ai-service
description: 画像の自動タグ付け、類似度計算、CCIP特徴量などのAI機能と Rust AI サービス (dghs-imgutils-rs) 連携を扱う。AI呼び出し、タグ推論、特徴量、SimilarSearch 調整時に使用する。
---

# Rust AI Tagger & CCIP スキル

## Working Rules

### 提供される機能
- 画像の自動タグ付け (キャラクター、IP、一般タグ)
- CCIP (Content-based Copy-detection via Image Perceptual hashing) 特徴量抽出
- 画像間の類似度計算

### AI サービス連携ルール
- AI機能への呼び出しは `apps/server/src/application/services/tagging-service.ts` を経由します
- AIサービスへの呼び出しはサービス層経由を基本にする。リトライ、エラー変換、ロギング、テスト差し替えの入口を一箇所に保つため。

### ネイティブ依存のビルド
- `dghs-imgutils-rs` は Rust の N-API アドオンです。`bun install` 時にソースからコンパイルされます。
- **GPU (CUDA) を有効にするには、システムの共有 ONNX Runtime を動的リンクします。** 静的にバンドルされた prebuilt バイナリでは CUDA provider が正しくロードされないため、以下の環境変数を指定してビルドしてください:
  ```bash
  ORT_PREFER_DYNAMIC_LINK=1 ORT_LIB_PATH=/usr/lib bun install
  ```
- 動的リンクを使う場合、`libonnxruntime.so.1` と `libonnxruntime_providers_cuda.so` が `/usr/lib` (または `LD_LIBRARY_PATH`) で見つかる必要があります。
- CPU のみでビルドする場合は `Cargo.toml` の `ort` features から `cuda` を削除してください。

## Task Routing

| ユーザーの意図 | やること |
|---|---|
| タグ付け機能の実装 | `tagging-service.ts` を経由して `RustAiClient` を呼び出し |
| 類似度計算 | CCIP特徴量を使用したサービス層の実装 |

CCIP抽出をjob化する場合は`job-system`、検索画面へ統合する場合は`media-search`も参照する。
