---
name: ai-service
description: 自動タグ付け、CCIP特徴量・類似検索、Rust AIサービス（dghs-imgutils-rs）連携を変更する時に使用する。
---

# AI Service

- 主実装は `packages/application/src/services/tagging-service.ts`、server adapterは `apps/server/src/infrastructure/services/tagging-service.ts`。
- AI clientはサービス層から呼び、リトライ・エラー変換・ログ・テスト差し替えを集約する。
- CCIPはキャラクター類似検索用の特徴量。job化は `job-system`、検索画面との接続は `media-search` を参照する。

## ネイティブ依存と推論設定

- 現行の `dghs-imgutils-rs` はinstall時にGitHub Releaseのprebuiltを取得し、SHA256を検証して配置する。通常installではRustをコンパイルしない。
- ONNX Runtimeとproviderライブラリは実行時に動的ロードする。必要なら `ORT_DYLIB_PATH` でORT本体を指定し、GPU利用時は対応するprovider・ドライバ・依存ライブラリもホストに用意する。
- CPU/GPUは `ai.provider`・`ai.device` で選び、`apps/server/src/infrastructure/ai/inference-options.ts` でnative optionsへ変換する。CPU利用のためにCargo featuresを変更しない。
- ソースビルドが必要な場合だけ依存先の現行README・build scriptを参照する。
