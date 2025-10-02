
# API設計

### 共通原則
- RESTful設計原則に準拠
- 一貫したエンドポイント命名規則
- HTTP動詞の適切な使い分け
- エラーハンドリングの統一
- **パスのワイルドカード (`*`)**: `/api/sources/:id/media/*` や `/api/sources/:id/directories/*` のようなパスにおける `*` は、ソース内のメディアまたはディレクトリの「完全な相対パス」を表します。SolidStartのルーティングでは `[...param]` を使用して表現されます。
- **パス処理の補足**: メディアリスト取得の `?path=subdir` と、特定のメディア操作の `*` ワイルドカードは、それぞれ異なるユースケース（フィルタリングと特定リソースの指定）に対応しています。
- **APIバージョニング**: 将来的な拡張性と後方互換性を考慮し、APIバージョニング（例: `/v1/api/...`）の導入を検討します。

### エンドポイント一覧

#### カテゴリ管理
```
GET    /api/categories              # すべてのカテゴリを一覧表示します。
POST   /api/categories              # 新しいカテゴリを作成します。
GET    /api/categories/:id          # 特定のカテゴリの詳細を取得します。
PUT    /api/categories/:id          # 特定のカテゴリを更新します。
DELETE /api/categories/:id          # 特定のカテゴリを削除します。
```

#### キャラクター管理
```
GET    /api/charactors              # すべてのキャラクターを一覧表示します。
POST   /api/charactors              # 新しいキャラクターを作成します。
GET    /api/charactors/:id          # 特定のキャラクターの詳細を取得します。
PUT    /api/charactors/:id          # 特定のキャラクターを更新します。
DELETE /api/charactors/:id          # 特定のキャラクターを削除します。
```

#### IP (知的財産) 管理
```
GET    /api/ips                     # すべてのIP（知的財産）を一覧表示します。
POST   /api/ips                     # 新しいIPを作成します。
GET    /api/ips/:id                 # 特定のIPの詳細を取得します。
PUT    /api/ips/:id                 # 特定のIPを更新します。
DELETE /api/ips/:id                 # 特定のIPを削除します。
```

#### メディアソース管理
```
GET    /api/sources                 # すべてのメディアソースを一覧表示します。
POST   /api/sources                 # 新しいメディアソースを作成します。
GET    /api/sources/:sourceId       # 特定のメディアソースの詳細を取得します。(sourceId: UUID)
PUT    /api/sources/:sourceId       # 特定のメディアソースを更新します。(sourceId: UUID)
DELETE /api/sources/:sourceId       # 特定のメディアソースを削除します。(sourceId: UUID)
POST   /api/sources/:sourceId/test  # メディアソースへの接続をテストします。(sourceId: UUID)
GET    /api/sources/:sourceId/status # 特定のメディアソースの状態を取得します。(sourceId: UUID)
GET    /api/sources/:sourceId/directories # 特定のメディアソース内のディレクトリ一覧を取得します。(sourceId: UUID)
GET    /api/sources/:sourceId/directories/[...directories] # 特定のディレクトリ下のすべてのメディアとディレクトリを取得します。(sourceId: UUID, directories: path)
```

#### メディア管理
```
GET    /api/sources/:sourceId/:mediaId                  # 特定のメディアの詳細を取得します。(sourceId: UUID, mediaId: UUID)
GET    /api/sources/:sourceId/:mediaId/details          # 特定のメディアのタグ、メタデータ、カテゴリ、IP、キャラクターなどの情報を取得します。(sourceId: UUID, mediaId: UUID)
PUT    /api/sources/:sourceId/:mediaId                  # 特定のメディア情報を更新します。(sourceId: UUID, mediaId: UUID)
GET    /api/sources/:sourceId/:mediaId/metadata         # 特定のメディアのメタデータを取得します。(sourceId: UUID, mediaId: UUID)
GET    /api/sources/:sourceId/:mediaId/tags             # 特定のメディアのタグ一覧を取得します。(sourceId: UUID, mediaId: UUID)
GET    /api/sources/:sourceId/:mediaId/thumbnail        # 特定のメディアのサムネイルを配信します。(sourceId: UUID, mediaId: UUID)
POST   /api/sources/:sourceId/:mediaId/upload           # メディアをアップロードします。アップロードパスはリクエストボディで提供されます。
GET    /api/sources/:sourceId/:mediaId/charactors       # メディアに関連付けられたすべてのキャラクターを取得します。(現在プレースホルダー)
GET    /api/sources/:sourceId/:mediaId/ips              # メディアに関連付けられたすべてのIPを取得します。(現在プレースホルダー)
GET    /api/sources/:sourceId/search                    # 特定のメディアソース内のメディアを検索します。(sourceId: UUID)
GET    /api/sources/:sourceId/directories/[...directories]/search # 特定のサブディレクトリ内のメディアを検索します。(sourceId: UUID, directories: path)
```
**注記: これらの機能はまだ実装されていません。**

#### サムネイル管理
```
GET    /api/sources/:sourceId/:mediaId/thumbnail        # 特定のメディアのサムネイルを配信します。(sourceId: UUID, mediaId: UUID)
POST   /api/sources/:sourceId/thumbnails                # サムネイルの手動生成を開始します。(sourceId: UUID)
DELETE /api/sources/:sourceId/thumbnails                # サムネイルキャッシュをクリアします。(sourceId: UUID)
```
**注記: これらの機能はまだ実装されていません。**

#### ディレクトリ管理
```
GET    /api/sources/:sourceId/directories?path=parent   # ディレクトリ一覧を取得します。(sourceId: UUID)
POST   /api/sources/:sourceId/directories               # ディレクトリを作成します。(sourceId: UUID, body: { path: string, name: string })
PUT    /api/sources/:sourceId/directories/rename        # ディレクトリ名を変更します。(sourceId: UUID, body: { oldPath: string, newPath: string })
DELETE /api/sources/:sourceId/directories/delete        # ディレクトリを削除します。(sourceId: UUID, body: { path: string })
```
**注記: これらの機能はまだ実装されていません。**

#### リアルタイム更新
```
GET    /api/sources/:sourceId/events                    # SSE（Server-Sent Events）を監視し、リアルタイム更新を受け取ります。(sourceId: UUID)
```
**注記: この機能はまだ実装されていません。**

#### 設定管理
```
GET    /api/config                               # アプリケーション設定を取得します。
PUT    /api/config                               # アプリケーション設定を更新します。
POST   /api/config                               # アプリケーション設定をデフォルトにリセットします。
```

#### タグ管理
```
GET    /api/tags                 # すべてのタグを一覧表示します。
POST   /api/tags                 # 新しいタグを作成します。
GET    /api/tags/:id            # 特定のタグの詳細を取得します。
PUT    /api/tags/:id            # 特定のタグを更新します。
DELETE /api/tags/:id            # 特定のタグを削除します。
```

#### データ構造
```typescript
interface MediaSource {
  id: string;           // UUID自動生成
  name: string;         // 表示されるメディアソースの名前
  description: string;  // メディアソースの説明
  type: 'local' | 'sftp' | 's3';
  connectionInfo: ConnectionInfo;
  createdAt: Date;
  updatedAt: Date;
}

type ConnectionInfo = LocalConnection | SftpConnection | S3Connection;

interface LocalConnection {
  path: string;         // "/home/user/media"
}

interface SftpConnection {
  host: string;
  port: number;
  username: string;
  password?: string;
  privateKey?: string;
  remotePath: string;   // "/remote/path/media"
}

interface S3Connection {
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  prefix?: string;      // "my-folder/subfolder"
}
```
