
# 将来拡張機能

### 1. バルク操作機能
複数メディアの一括処理による効率化
- POST /api/sources/:id/media/bulk-edit - 複数メディアの一括編集
- DELETE /api/sources/:id/media/bulk-delete - 複数メディアの一括削除  
- POST /api/sources/:id/media/bulk-move - 複数メディアの一括移動
- POST /api/sources/:id/media/bulk-tag - 複数メディアの一括タグ付け

### 2. 統計・分析機能
データ分析とパフォーマンス監視
- GET /api/sources/:id/stats - ソース統計（メディア数、サイズ等）
- GET /api/stats/global - 全体統計
- GET /api/sources/:id/media/duplicates - 重複メディア検出
- GET /api/sources/:id/media/*/similar - 類似メディア検索
- GET /api/analytics/popular - 人気メディアランキング

### 3. エクスポート・インポート機能
データ移行とバックアップ支援
- GET /api/sources/:id/export?format=zip - アーカイブエクスポート
- POST /api/sources/:id/import - インポート（URL/ファイル）
- GET /api/sources/:id/media/*/download - メディアダウンロード
- POST /api/sources/clone/:sourceId - ソース複製

### 4. ワークフロー・自動化機能
バックグラウンドタスクとジョブ管理
- POST /api/sources/:id/sync - 手動同期実行
- GET /api/jobs - ジョブ一覧・ステータス
- POST /api/jobs/:id/cancel - ジョブキャンセル
- POST /api/sources/:id/auto-tag - AI自動タグ付け

### 5. フィルタ・プリセット機能
検索条件の保存と再利用
- GET /api/filters/presets - 保存済みフィルタ
- POST /api/filters/presets - フィルタ保存
- GET /api/sources/:id/media/random - ランダムメディア取得
- GET /api/sources/:id/media/recent - 最近のメディア

### 6. 外部連携機能
ComfyUIや他サービスとの統合
- POST /api/integrations/comfyui/upload - ComfyUIに直接アップロード
- GET /api/integrations/comfyui/workflows - ワークフロー一覧
- POST /api/integrations/discord/webhook - Discord通知
