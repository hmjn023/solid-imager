# Plan: コードレビュー結果の修正とアーキテクチャの改善

## Phase 1: 環境クリーンアップと基盤整備 [checkpoint: 6bd4863]
- [x] Task: `tsc_output.txt` の削除 5f6f5b6
- [x] Task: `ServiceRegistry` または `MediaService` にシングルトンのリセット機能を追加 a83c732
- [x] Task: Conductor - User Manual Verification 'Phase 1' (Protocol in workflow.md) 6bd4863

## Phase 2: MediaService のリファクタリング (DI & API)
- [ ] Task: `MediaServiceImpl` コンストラクタの更新（全リポジトリの注入）
- [ ] Task: `_copyMediaMetadata` の注入済みリポジトリ利用への修正
- [ ] Task: `uploadMedia` のシグネチャ変更（型付きオブジェクトへの移行）
- [ ] Task: 上記変更に伴う各ルート・テストの修正
- [ ] Task: Conductor - User Manual Verification 'Phase 2' (Protocol in workflow.md)

## Phase 3: BackupService の最適化
- [ ] Task: `restoreSource` におけるバルクインサートロジックの実装
- [ ] Task: 大規模データを用いたパフォーマンスの改善確認（テストコード上での検証）
- [ ] Task: Conductor - User Manual Verification 'Phase 3' (Protocol in workflow.md)

## Phase 4: 最終検証
- [ ] Task: `npm run typecheck` による型エラーの不在確認
- [ ] Task: `npm test` による既存機能へのデグレード不在確認
- [ ] Task: Conductor - User Manual Verification 'Phase 4' (Protocol in workflow.md)
