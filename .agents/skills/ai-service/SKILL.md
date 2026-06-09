---
name: ai-service
description: 画像の自動タグ付け、類似度計算、CCIP特徴量などのAI機能の利用とローカル Rust AI サービス (dghs-imgutils-rs) の管理。AI 機能への呼び出しや、ベクトル検索機能（SimilarSearch）の調整を行う際に使用してください。
---

# Rust AI Tagger & CCIP スキル

## Working Rules

### 提供される機能
- 画像の自動タグ付け (キャラクター、IP、一般タグ)
- CCIP (Content-based Copy-detection via Image Perceptual hashing) 特徴量抽出
- 画像間の類似度計算

### AI サービス連携ルール
- AI機能への呼び出しは `apps/server/src/application/services/tagging-service.ts` を経由します
- 直接 API を呼び出さず、必ずサービス層を通してください

## Task Routing

| ユーザーの意図 | やること |
|---|---|
| タグ付け機能の実装 | `tagging-service.ts` を経由して `RustAiClient` を呼び出し |
| 類似度計算 | CCIP特徴量を使用したサービス層の実装 |
