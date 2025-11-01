import type { Category, NewCategory } from '~/infrastructure/db/schema';

/**
 * すべてのカテゴリを取得します。
 * @returns - カテゴリの配列。
 */
export declare function selectAllCategories(): Promise<Category[]>;

/**
 * 新しいカテゴリをデータベースに挿入します。
 * @param data - 挿入するカテゴリのデータ。
 * @returns - 挿入されたカテゴリオブジェクト。
 */
export declare function insertCategory(data: NewCategory): Promise<Category>;

/**
 * 指定されたIDのカテゴリを更新します。
 * @param id - 更新するカテゴリのID。
 * @param data - 更新するデータ。
 * @returns - 更新されたカテゴリオブジェクト。
 */
export declare function updateCategory(id: number, data: Partial<NewCategory>): Promise<Category>;

/**
 * 指定されたIDのカテゴリを削除します。
 * @param id - 削除するカテゴリのID。
 */
export declare function deleteCategory(id: number): Promise<void>;
