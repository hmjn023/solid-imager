import type { MediaSource, NewMediaSource } from "~/infrastructure/db/schema";

/**
 * すべてのメディアソースを取得します。
 * @returns - メディアソースの配列。
 */
export declare function selectAllMediaSources(): Promise<MediaSource[]>;

/**
 * 指定されたIDのメディアソースを1件取得します。
 * @param id - 取得するメディアソースのUUID。
 * @returns - メディアソースオブジェクト。見つからない場合は undefined。
 */
export declare function selectMediaSourceById(
  id: string
): Promise<MediaSource | undefined>;

/**
 * 新しいメディアソースをデータベースに挿入します。
 * @param data - 挿入するメディアソースのデータ。
 * @returns - 挿入されたメディアソースオブジェクト。
 */
export declare function insertMediaSource(
  data: NewMediaSource
): Promise<MediaSource>;

/**
 * 指定されたIDのメディアソース情報を更新します。
 * @param id - 更新するメディアソースのUUID。
 * @param data - 更新するデータ（部分的な更新も可能）。
 * @returns - 更新されたメディアソースオブジェクト。
 */
export declare function updateMediaSource(
  id: string,
  data: Partial<NewMediaSource>
): Promise<MediaSource>;

/**
 * 指定されたIDのメディアソースを削除します。
 * @param id - 削除するメディアソースのUUID。
 */
export declare function deleteMediaSource(id: string): Promise<void>;
