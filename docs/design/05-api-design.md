
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
GET    /api/characters                        # すべてのキャラクターを一覧表示します。
POST   /api/characters                        # 新しいキャラクターを作成します。
GET    /api/characters/:id                    # 特定のキャラクターの詳細を取得します。
PUT    /api/characters/:id                    # 特定のキャラクターを更新します。
DELETE /api/characters/:id                    # 特定のキャラクターを削除します。
GET    /api/characters/search?q={query}       # 名前とエイリアスの両方から検索します。
GET    /api/ips/:ipId/characters              # 特定IPに属するキャラクター一覧を取得します。(ipId: number)
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
POST   /api/sources                 # 新しいメディアソースを作成し、オプションでインポートデータ（アーカイブURLやファイル）から初期化します。
GET    /api/sources/:sourceId       # 特定のメディアソースの詳細を取得します。(sourceId: UUID)
PUT    /api/sources/:sourceId       # 特定のメディアソースを更新します。(sourceId: UUID)
DELETE /api/sources/:sourceId       # 特定のメディアソースを削除します。(sourceId: UUID)
POST   /api/sources/:sourceId/test  # メディアソースへの接続をテストします。(sourceId: UUID)
POST   /api/sources/:sourceId/test  # メディアソースへの接続をテストします。(sourceId: UUID)
GET    /api/sources/:sourceId/status # 特定のメディアソースの状態を取得します。(sourceId: UUID)
GET    /api/sources/:sourceId/directories               # ソース内のディレクトリツリーを取得します。(sourceId: UUID)
POST   /api/sources/:sourceId/directories               # ディレクトリを作成します。(sourceId: UUID, body: { path: string, name: string })
GET    /api/sources/:sourceId/directories/[...directories] # 特定のディレクトリ下のすべてのメディアとディレクトリを取得します。(sourceId: UUID, directories: path) (サブディレクトリ内のメディアを取得)
```

#### メディア管理
```
GET    /api/sources/:sourceId/:mediaId                  # 特定のメディアの詳細を取得します。(sourceId: UUID, mediaId: UUID)
GET    /api/sources/:sourceId/:mediaId/details          # 特定のメディアのタグ、メタデータ、カテゴリ、IP、キャラクターなどの情報を取得します。(sourceId: UUID, mediaId: UUID)
PUT    /api/sources/:sourceId/:mediaId                  # 特定のメディア情報を更新します。(sourceId: UUID, mediaId: UUID)
DELETE /api/sources/:sourceId/:mediaId                  # 特定のメディアを削除します。(sourceId: UUID, mediaId: UUID)
GET    /api/sources/:sourceId/:mediaId/metadata         # 特定のメディアのメタデータを取得します。(sourceId: UUID, mediaId: UUID)
PUT    /api/sources/:sourceId/:mediaId/metadata         # 特定のメディアのメタデータを更新します。(sourceId: UUID, mediaId: UUID)
GET    /api/sources/:sourceId/:mediaId/tags             # 特定のメディアのタグ一覧を取得します。(sourceId: UUID, mediaId: UUID)
GET    /api/sources/:sourceId/:mediaId/thumbnail        # 特定のメディアのサムネイルを配信します。(sourceId: UUID, mediaId: UUID)
POST   /api/sources/:sourceId/upload                    # メディアをアップロードします。アップロードパスはリクエストボディで提供されます。
GET    /api/sources/:sourceId/:mediaId/characters       # メディアに関連付けられたすべてのキャラクターを取得します。
GET    /api/sources/:sourceId/:mediaId/ips              # メディアに関連付けられたすべてのIPを取得します。
POST   /api/sources/:sourceId/:mediaId/tags             # 特定のメディアにタグを追加します。(sourceId: UUID, mediaId: UUID, body: { tagId: number })
DELETE /api/sources/:sourceId/:mediaId/tags/:tagId      # 特定のメディアからタグを削除します。(sourceId: UUID, mediaId: UUID, tagId: number)
POST   /api/sources/:sourceId/:mediaId/characters       # 特定のメディアにキャラクターを追加します。(sourceId: UUID, mediaId: UUID, body: { characterId: number })
DELETE /api/sources/:sourceId/:mediaId/characters/:characterId # 特定のメディアからキャラクターを削除します。(sourceId: UUID, mediaId: UUID, characterId: number)
POST   /api/sources/:sourceId/:mediaId/ips              # 特定のメディアにIPを追加します。(sourceId: UUID, mediaId: UUID, body: { ipId: number })
DELETE /api/sources/:sourceId/:mediaId/ips/:ipId        # 特定のメディアからIPを削除します。(sourceId: UUID, mediaId: UUID, ipId: number)
GET    /api/sources/:sourceId/:mediaId/relations        # メディアの関連情報（親子関係）を取得します。(sourceId: UUID, mediaId: UUID)
POST   /api/sources/:sourceId/:mediaId/relations        # メディアの関連を作成します。(sourceId: UUID, mediaId: UUID, body: { childMediaId: UUID, relationType: 'variant'|'version'|'page'|'derivative'|'edit'|'source', orderIndex?: number, metadata?: any })
DELETE /api/sources/:sourceId/:mediaId/relations/:relationId # メディアの関連を削除します。(sourceId: UUID, mediaId: UUID, relationId: number)
GET    /api/sources/:sourceId/:mediaId/relations/children # 子メディア一覧を取得します。(sourceId: UUID, mediaId: UUID)
GET    /api/sources/:sourceId/:mediaId/relations/parents  # 親メディア一覧を取得します。(sourceId: UUID, mediaId: UUID)
GET    /api/sources/:sourceId/search                    # 特定のメディアソース内のメディアを検索します。(sourceId: UUID)
GET    /api/sources/:sourceId/directories/[...directories]/search # 特定のサブディレクトリ内のメディアを検索します。(sourceId: UUID, directories: path)
GET    /api/sources/:sourceId/media/search/by-generation # AI生成パラメータでメディアを検索します。(sourceId: UUID, query: modelName?, prompt?, loras?, cfgScaleMin?, cfgScaleMax?, stepsMin?, stepsMax?)
GET    /api/sources/:sourceId/media/search/by-lora?name={loraName} # 特定LoRAを使用したメディアを検索します。(sourceId: UUID)
GET    /api/sources/:sourceId/media/search/by-prompt?q={text}      # プロンプトテキストでメディアを検索します。(sourceId: UUID)
GET    /api/sources/:sourceId/media/search/by-workflow?hash={hash} # ワークフローハッシュでメディアを検索します。(sourceId: UUID)

#### グローバル検索
```
GET    /api/search                           # すべてのメディアソースを横断してメディアを検索します。
GET    /api/search/by-generation             # すべてのメディアソースを横断してAI生成パラメータでメディアを検索します。(query: modelName?, prompt?, loras?, cfgScaleMin?, cfgScaleMax?, stepsMin?, stepsMax?)
GET    /api/search/by-character?name={name}  # キャラクター名またはエイリアスでメディアを検索します。
```
```
**注記: これらの機能はまだ実装されていません。**

GET    /api/sources/:sourceId/thumbnails/all            # 特定のメディアソース内のすべてのサムネイルのリンクを取得します。(sourceId: UUID)
GET    /api/sources/:sourceId/:mediaId/thumbnail        # 特定のメディアのサムネイルを配信します。(sourceId: UUID, mediaId: UUID)
POST   /api/sources/:sourceId/thumbnails                # サムネイルの手動生成を開始します。(sourceId: UUID) (generateThumbnailsForSourceに統一)
DELETE /api/sources/:sourceId/thumbnails                # サムネイルキャッシュをクリアします。(sourceId: UUID)
```
**注記: これらの機能はまだ実装されていません。**

#### ディレクトリ管理
```
GET    /api/sources/:sourceId/directories   # ディレクトリツリーを取得します。(sourceId: UUID)
POST   /api/sources/:sourceId/directories               # ディレクトリを作成します。(sourceId: UUID, body: { path: string, name: string })
DELETE /api/sources/:sourceId/directories               # ディレクトリを削除します。(sourceId: UUID, body: { path: string })
PUT    /api/sources/:sourceId/directories               # ディレクトリ名を変更/移動します。(sourceId: UUID, body: { oldPath: string, newPath: string })
PUT    /api/sources/:sourceId/directories/rename        # ディレクトリ名を変更します。(sourceId: UUID, body: { oldPath: string, newPath: string })
DELETE /api/sources/:sourceId/directories/delete        # ディレクトリを削除します。(sourceId: UUID, body: { path: string })
```
**注記: これらの機能はまだ実装されていません。**

#### リアルタイム更新
```
GET    /api/sources/:sourceId/events                    # SSE（Server-Sent Events）を監視し、リアルタイム更新を受け取ります。(sourceId: UUID)
GET    /api/sources/:sourceId/events/thumbnail-progress # サムネイル生成の進捗をリアルタイムで受け取ります。(sourceId: UUID)
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
GET    /api/tags                                         # すべてのタグを一覧表示します。
POST   /api/tags                                         # 新しいタグを作成します。
GET    /api/tags/:id                                     # 特定のタグの詳細を取得します。
PUT    /api/tags/:id                                     # 特定のタグを更新します。
DELETE /api/tags/:id                                     # 特定のタグを削除します。
GET    /api/tags/search?q={query}&attribute={attribute}  # タグを検索します（属性フィルタ付き）。
GET    /api/tags/by-attribute/:attribute                 # 特定属性のタグ一覧を取得します。(attribute: string)
GET    /api/tags/by-source/:source                       # 特定起源のタグ一覧を取得します。(source: string, e.g., 'manual', 'comfyui_workflow')
```

#### ユーザー管理
```
GET    /api/users                     # すべてのユーザーを一覧表示します。
POST   /api/users                     # 新しいユーザーを作成します。
GET    /api/users/:id                 # 特定のユーザーの詳細を取得します。
PUT    /api/users/:id                 # 特定のユーザーを更新します。
DELETE /api/users/:id                 # 特定のユーザーを削除します。
```

#### コレクション管理
```
GET    /api/collections               # すべてのコレクションを一覧表示します。
POST   /api/collections               # 新しいコレクションを作成します。
GET    /api/collections/:id           # 特定のコレクションの詳細を取得します。
PUT    /api/collections/:id           # 特定のコレクションを更新します。
DELETE /api/collections/:id           # 特定のコレクションを削除します。
POST   /api/collections/:collectionId/media # コレクションにメディアを追加します。(collectionId: UUID, body: { mediaId: UUID, displayOrder?: number })
DELETE /api/collections/:collectionId/media/:mediaId # コレクションからメディアを削除します。(collectionId: UUID, mediaId: UUID)
```

#### バルク操作
```
POST   /api/sources/:sourceId/media/bulk-edit                 # 複数メディアを一括編集します。(sourceId: UUID, body: { mediaIds: UUID[], updates: any })
DELETE /api/sources/:sourceId/media/bulk-delete               # 複数メディアを一括削除します。(sourceId: UUID, body: { mediaIds: UUID[] })
POST   /api/sources/:sourceId/media/bulk-move                 # 複数メディアを一括移動します。(sourceId: UUID, body: { mediaIds: UUID[], destinationPath: string })
POST   /api/sources/:sourceId/media/bulk-tag                  # 複数メディアを一括タグ付けします。(sourceId: UUID, body: { mediaIds: UUID[], tagsToAdd: number[], tagsToRemove: number[] })
POST   /api/sources/:sourceId/media/bulk-update-generation-info # 複数メディアのAI生成情報を一括更新します。(sourceId: UUID, body: { mediaIds: UUID[], updates: { modelName?, prompt?, negativePrompt?, loras?, vae? } })
POST   /api/sources/:sourceId/media/bulk-assign-characters    # 複数メディアにキャラクターを一括割り当てします。(sourceId: UUID, body: { mediaIds: UUID[], characterIds: number[], confidence?: number })
POST   /api/characters/bulk-update-aliases                    # 複数キャラクターのエイリアスを一括更新します。(body: { characterIds: number[], aliasesToAdd?: string[], aliasesToRemove?: string[] })
```

#### データ移行・同期
```
GET    /api/sources/:sourceId/export?format=zip              # メディアソースをアーカイブとしてエクスポートします。(sourceId: UUID)
POST   /api/sources/:sourceId/import                         # 既存のメディアソースにデータをインポートします（新しいメディアの追加、既存メディアの更新、外部ソースからのデータマージなど）。(sourceId: UUID, body: { url?: string, file?: File })
POST   /api/sources/:sourceId/sync                           # 他の（クライアントの同じIDを持つ）ソースとの同期を想定し、概ね同じファイルを持つソースとの間でデータをマージまたは更新します。(sourceId: UUID, body: { data: any })
POST   /api/sources/:sourceId/scan                           # メディアソースの手動スキャンを実行します。(sourceId: UUID)
POST   /api/sources/clone/:sourceId                          # メディアソースを複製します。(sourceId: UUID, body: { newName: string })
GET    /api/sources/:sourceId/media/:mediaId/download        # 特定のメディアをダウンロードします。(sourceId: UUID, mediaId: UUID)
GET    /api/sources/:sourceId/media/:mediaId/sync-status     # 特定のメディアの同期ステータスを取得します。(sourceId: UUID, mediaId: UUID)
POST   /api/sources/:sourceId/media/:mediaId/sync            # 特定のメディアを同期します。(sourceId: UUID, mediaId: UUID, body: { backupUrl: string })
POST   /api/sources/:sourceId/media/:mediaId/sync/retry      # 同期に失敗したメディアを再試行します。(sourceId: UUID, mediaId: UUID)
GET    /api/sources/:sourceId/media/sync/failed              # 同期に失敗したメディア一覧を取得します。(sourceId: UUID)
GET    /api/sources/:sourceId/media/sync/pending             # 同期待ちメディア一覧を取得します。(sourceId: UUID)
```

#### 統計・分析機能
```
GET    /api/sources/:sourceId/stats             # ソース統計（メディア数、サイズ等）を取得します。(sourceId: UUID)
GET    /api/stats/global                        # 全体統計を取得します。
GET    /api/sources/:sourceId/media/duplicates  # 重複メディアを検出します。(sourceId: UUID)
GET    /api/sources/:sourceId/media/*/similar   # 類似メディアを検索します。(sourceId: UUID, mediaPath: path)
GET    /api/analytics/popular                   # 人気メディアランキングを取得します。
GET    /api/analytics/models                    # モデル使用統計を取得します。
GET    /api/analytics/loras                     # LoRA使用統計を取得します。
GET    /api/analytics/characters                # キャラクター出現頻度統計を取得します。
GET    /api/analytics/generation-trends         # AI生成パラメータのトレンド分析を取得します。
GET    /api/analytics/prompts/keywords          # 頻出プロンプトキーワードを取得します。
```

#### ワークフロー・自動化機能
```
GET    /api/jobs                                # ジョブ一覧とステータスを取得します。
GET    /api/jobs/:id                            # 特定のジョブの詳細を取得します。(id: UUID)
POST   /api/jobs/:id/cancel                     # 特定のジョブをキャンセルします。(id: UUID)
POST   /api/jobs/:id/retry                      # 失敗したジョブを再試行します。(id: UUID)
DELETE /api/jobs/:id                            # 特定のジョブを削除します。(id: UUID)
POST   /api/sources/:sourceId/auto-tag          # AIによる自動タグ付けを実行します。(sourceId: UUID)
```

#### フィルタ・プリセット機能
```
GET    /api/filters/presets                     # 保存済みフィルタの一覧を取得します。
POST   /api/filters/presets                     # フィルタを保存します。(body: { name: string, conditions: any })
GET    /api/filters/presets/:id                 # 特定プリセットの詳細を取得します。(id: number)
PUT    /api/filters/presets/:id                 # プリセットを更新します。(id: number, body: { name?: string, conditions?: any })
DELETE /api/filters/presets/:id                 # プリセットを削除します。(id: number)
GET    /api/sources/:sourceId/media/random      # ランダムなメディアを取得します。(sourceId: UUID)
GET    /api/sources/:sourceId/media/recent      # 最近追加されたメディアを取得します。(sourceId: UUID)
```

#### 外部連携機能
```
POST   /api/integrations/comfyui/upload         # ComfyUIに直接メディアをアップロードします。(body: { mediaId: UUID, comfyUiUrl: string })
GET    /api/integrations/comfyui/workflows      # ComfyUIのワークフロー一覧を取得します。
POST   /api/integrations/discord/webhook        # Discordに通知を送信します。(body: { message: string, webhookUrl: string })
```

#### データ構造
