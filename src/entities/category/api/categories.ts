import { randomUUID } from 'expo-crypto';

import { getLocalDb } from '@/shared/api/local-db';

import type {
  CreateLocalCategoryParams,
  LocalCategory,
  LocalCategoryType,
  UpdateLocalCategoryParams,
} from '../model/types';

const ensureCategoryNameAvailable = async (
  userId: string,
  name: string,
  type: LocalCategoryType,
  excludedId: string | null = null
) => {
  const database = await getLocalDb();
  const category = await database.getFirstAsync<{ id: string }>(
    `select id from categories
     where user_id = ? and name = ? and type = ? and (? is null or id != ?)
     limit 1;`,
    userId,
    name,
    type,
    excludedId,
    excludedId
  );

  if (category) {
    throw new Error('Категория с таким названием и типом уже существует');
  }
};

export async function createLocalCategory(params: CreateLocalCategoryParams) {
  const database = await getLocalDb();
  const now = new Date().toISOString();
  const id = randomUUID();

  await ensureCategoryNameAvailable(params.userId, params.name.trim(), params.type);

  await database.runAsync(
    `
      insert into categories (
        id,
        user_id,
        remote_id,
        type,
        name,
        color,
        icon,
        sort_order,
        created_at,
        updated_at,
        sync_status,
        sync_error,
        exclude_from_average
      )
      values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `,
    id,
    params.userId,
    null,
    params.type,
    params.name.trim(),
    params.color ?? null,
    params.icon ?? null,
    params.sortOrder ?? 0,
    now,
    now,
    'pending',
    null,
    params.excludeFromAverage ? 1 : 0
  );

  const category = await getLocalCategoryById(params.userId, id);

  if (!category) {
    throw new Error('Не удалось создать локальную категорию');
  }

  return category;
}

export async function getLocalCategoryById(userId: string, id: string) {
  const database = await getLocalDb();

  return database.getFirstAsync<LocalCategory>(
    `
      select *
      from categories
      where user_id = ? and id = ?;
    `,
    userId,
    id
  );
}

export async function getLocalCategories(userId: string, type?: LocalCategoryType) {
  const database = await getLocalDb();

  if (type) {
    return database.getAllAsync<LocalCategory>(
      `
        select *
        from categories
        where user_id = ? and type = ?
        order by sort_order asc, name asc;
      `,
      userId,
      type
    );
  }

  return database.getAllAsync<LocalCategory>(
    `
      select *
      from categories
      where user_id = ?
      order by type asc, sort_order asc, name asc;
    `,
    userId
  );
}

export async function updateLocalCategory(params: UpdateLocalCategoryParams) {
  const database = await getLocalDb();
  const currentCategory = await getLocalCategoryById(params.userId, params.id);

  if (!currentCategory) {
    throw new Error('Локальная категория не найдена');
  }

  const name = params.name?.trim() ?? currentCategory.name;
  const type = params.type ?? currentCategory.type;

  if (name !== currentCategory.name || type !== currentCategory.type) {
    await ensureCategoryNameAvailable(params.userId, name, type, params.id);
  }

  await database.runAsync(
    `
      update categories
      set
        type = ?,
        name = ?,
        color = ?,
        icon = ?,
        sort_order = ?,
        updated_at = ?,
        sync_status = ?,
        sync_error = ?,
        exclude_from_average = ?
      where user_id = ? and id = ?;
    `,
    type,
    name,
    params.color === undefined ? currentCategory.color : params.color,
    params.icon === undefined ? currentCategory.icon : params.icon,
    params.sortOrder ?? currentCategory.sort_order,
    new Date().toISOString(),
    'pending',
    null,
    params.excludeFromAverage === undefined
      ? currentCategory.exclude_from_average
      : params.excludeFromAverage ? 1 : 0,
    params.userId,
    params.id
  );

  const updatedCategory = await getLocalCategoryById(params.userId, params.id);

  if (!updatedCategory) {
    throw new Error('Не удалось обновить локальную категорию');
  }

  return updatedCategory;
}

export async function deleteLocalCategory(userId: string, id: string) {
  const database = await getLocalDb();

  await database.runAsync(
    `
      delete from categories
      where user_id = ? and id = ?;
    `,
    userId,
    id
  );
}

export async function getPendingLocalCategories(userId: string) {
  const database = await getLocalDb();

  return database.getAllAsync<LocalCategory>(
    `
      select *
      from categories
      where user_id = ? and sync_status in ('pending', 'failed')
      order by created_at asc;
    `,
    userId
  );
}
