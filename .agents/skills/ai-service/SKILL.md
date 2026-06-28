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

## Task Routing

| ユーザーの意図 | やること |
|---|---|
| タグ付け機能の実装 | `tagging-service.ts` を経由して `RustAiClient` を呼び出し |
| 類似度計算 | CCIP特徴量を使用したサービス層の実装 |
