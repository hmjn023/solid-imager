# CCIP pgvector 類似検索ベンチマーク

CCIP の pgvector 検索は、候補取得、media の再取得、Rust による再ランキングを分けて計測する。
アプリケーションの構造化ログには、各段階の `durationMs` と候補件数が出力される。

## 検索計画の確認

本番相当の DB で、実際のアンカー vector に置き換えて次を実行する。

```sql
BEGIN;
SET LOCAL hnsw.ef_search = 40;
SET LOCAL hnsw.iterative_scan = 'relaxed_order';

EXPLAIN (ANALYZE, BUFFERS)
SELECT
  ce.region_id,
  ce.embedding <=> '[...]'::vector AS cosine_distance
FROM ccip_embeddings AS ce
JOIN media_regions AS mr ON mr.id = ce.region_id
JOIN media AS m ON m.id = mr.media_id
WHERE mr.kind = 'full'
  AND ce.model = 'ccip-caformer-24-randaug-pruned'
  AND ce.embedding_version = 1
ORDER BY ce.embedding <=> '[...]'::vector
LIMIT 1000;

ROLLBACK;
```

`Index Scan using idx_ccip_embeddings_embedding_cosine` が選択されること、
`Rows Removed by Filter` と `Buffers` の変化を確認する。`ef_search` は 40、80、160
などで比較し、品質評価と同じ条件で速度を測定する。

`hnsw.iterative_scan` を有効にした場合と無効にした場合を比較する。フィルタ後の
返却件数が要求件数を下回らないか、同一条件の exact search と結果一致率または再現率が
許容範囲に収まるかを確認する。source filter の有無も別ケースとして測定する。

## 本番 migration の適用

Drizzle の PostgreSQL migrator は migration 全体をトランザクション内で実行するため、
`CREATE INDEX CONCURRENTLY` を migration ファイルへ直接記載できない。書き込みを止めたくない
本番では、通常の migration 実行前に次を autocommit で実行する。

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS
  idx_ccip_embeddings_embedding_cosine
ON ccip_embeddings USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
```

0019 migration 側も `IF NOT EXISTS` としているため、事前作成済みなら no-op になり、
通常の migration 記録を安全に進められる。空の環境では migration が通常の index 作成を行う。

## p50 / p95 の集計

同一条件の検索を十分な回数実行し、ログから次のメッセージを抽出する。

- `CCIP pgvector candidate search completed`: DB候補取得
- `CCIP similar media lookup completed`: media再取得
- `CCIP Rust reranking completed`: Rust再ランキング

各メッセージの `durationMs` を、ウォームアップ分を除いて p50 / p95 に集計する。
結果には `candidateLimit`、実候補数、再ランキング件数、`ef_search`、DB の CPU/メモリ、
結果一致率または再現率を併記する。LanceDB との比較では同じアンカー、topK、候補数、
モデル・embedding version を使用する。

このリポジトリでは本番相当の約 88k vectors と DB 接続を持たないため、実測値は記録していない。
