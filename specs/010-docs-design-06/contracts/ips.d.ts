import type { Ip, NewIp } from '~/infrastructure/db/schema';

/**
 * すべてのIP（知的財産）を取得します。
 * @returns - IPの配列。
 */
export declare function selectAllIps(): Promise<Ip[]>;

/**
 * 新しいIPをデータベースに挿入します。
 * @param data - 挿入するIPのデータ。
 * @returns - 挿入されたIPオブジェクト。
 */
export declare function insertIp(data: NewIp): Promise<Ip>;

/**
 * 指定されたIDのIPを更新します。
 * @param id - 更新するIPのID。
 * @param data - 更新するデータ。
 * @returns - 更新されたIPオブジェクト。
 */
export declare function updateIp(id: number, data: Partial<NewIp>): Promise<Ip>;

/**
 * 指定されたIDのIPを削除します。
 * @param id - 削除するIPのID。
 */
export declare function deleteIp(id: number): Promise<void>;
