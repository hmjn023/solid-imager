# CCIP pgvector 類似検索ベンチマーク

CCIP の pgvector 検索は、候補取得、media の再取得、Rust による再ランキングを分けて計測する。
アプリケーションの構造化ログには、各段階の `durationMs` と候補件数が出力される。

## 検索計画の確認

本番相当の DB で、実際のアンカー vector に置き換えて次を実行する。

```sql
BEGIN;
SET LOCAL hnsw.ef_search = 40;

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
