# Implementation Report: Intelligent Character Management System

## 1. Executive Summary
`solid-imager` におけるキャラクター管理を、従来の「モデル依存のタグ付け」から、**「AIモデル (PixAI Tagger) + ベクトル検索 (CCIP/pgvector) によるRAG型ハイブリッド認識」** へアップグレードするための技術仕様書です。既存の2万枚の画像資産を最大限に活用し、未知のキャラクターに対する学習・検索能力をシステムに持たせます。

## 2. System Architecture
本システムは以下の3層構造で動作します。

1.  **Tagging Layer (PixAI Tagger v0.9)**:
    *   既知のキャラクター（1.3万種）と作品名 (IP) を識別。
    *   ONNX形式で `dghs-imgutils-ts` を通じて実行。
2.  **Embedding Layer (CCIP - Character Classification by Image Pairs)**:
    *   画像を **768次元の固有ベクトル** に変換。
    *   「見た目」の類似度を数値化し、タグに頼らない識別を可能にする。
3.  **Storage & Retrieval Layer (PGLite + pgvector)**:
    *   抽出したベクトルとタグ情報を `pgvector` 形式で保存。
    *   `HNSW` インデックスにより、2万枚以上のデータからミリ秒単位で類似キャラを検索。

## 3. Key Workflows

### A. Automatic Recognition & Learning
1.  画像インポート時に `PixAI Tagger` でタグを抽出。
2.  タグにキャラクター名が含まれない場合、`CCIP` ベクトルで `pgvector` DBを検索。
3.  類似度（Cosine Distance < 0.15）が高い既存キャラがいれば、自動的にその名前を付与。
4.  一致するものがない場合、UIで「未知のキャラクター」として提示。ユーザーが命名すると、そのベクトルがDBに登録され、以降の画像は自動認識される。

### B. Batch Migration (For 20,000+ existing images)
*   **推論処理**: GPU (RTX 3060+) で約15〜20分、CPUで数時間のバッチ処理。
*   **インデックス**: `HNSW` を使用することで、$n^2$ の全件比較を回避し、$O(\log n)$ の高速検索を実現。
*   **データ量**: ベクトルデータ自体は約60MB程度と軽量。

## 4. Technical Requirements for Coding Agent

### Dependencies
*   `dghs-imgutils-ts`: `tagging/pixai` および `metrics/ccip` の移植版。
*   `@electric-sql/pglite`: `vector` エクステンションを有効化。
*   `onnxruntime-node`: 高速な推論実行用。

### Database Schema (Proposal)
```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS character_registry (
  id SERIAL PRIMARY KEY,
  file_path TEXT UNIQUE,
  character_name TEXT, -- PixAI tag or User-defined name
  ip_name TEXT,
  embedding vector(768), -- CCIP embedding
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- HNSW Index for fast similarity search
CREATE INDEX ON character_registry 
USING hnsw (embedding vector_cosine_ops) 
WITH (m = 16, ef_construction = 64);
```

### Critical Logic: Identification (Pseudo-code)
```typescript
async function identifyCharacter(embedding: Float32Array) {
  const result = await db.query(`
    SELECT character_name, embedding <=> $1 as distance 
    FROM character_registry 
    WHERE character_name IS NOT NULL
    ORDER BY distance ASC LIMIT 1;
  `, [JSON.stringify(Array.from(embedding))]);

  const match = result.rows[0];
  if (match && match.distance < 0.15) {
    return { name: match.character_name, confidence: 1 - match.distance };
  }
  return null; // Unknown
}
```

## 5. UI/UX Considerations for `solid-imager`
*   **Identity Suggestion**: 未知のキャラに対して「このキャラは Aさん ですか？」という候補提示機能。
*   **Clustering View**: 名前がない画像同士でベクトルが近いものをグループ化して表示し、一括で名前を付けられる機能。
*   **Manual Correction**: AIが間違えた場合に、ベクトルDBの登録情報を修正・マージする機能。
