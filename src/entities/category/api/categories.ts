import { getLocalDb } from '@/shared/api/local-db';

import type {
  CreateLocalCategoryParams,
  LocalCategory,
  LocalCategoryType,
  UpdateLocalCategoryParams,
} from '../model/types';

function createLocalId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export async function createLocalCategory(params: CreateLocalCategoryParams) {
  const database = await getLocalDb();
  const now = new Date().toISOString();
  const id = createLocalId();

  await database.runAsync(
    `
      insert into categories (
        id,
        remote_id,
        type,
        name,
        color,
        icon,
        sort_order,
        created_at,
        updated_at,
        sync_status,
        sync_error
      )
      values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `,
    id,
    null,
    params.type,
    params.name.trim(),
    params.color ?? null,
    params.icon ?? null,
    params.sortOrder ?? 0,
    now,
    now,
    'pending',
    null
  );

  const category = await getLocalCategoryById(id);

  if (!category) {
    throw new Error('Не удалось создать локальную категорию');
  }

  return category;
}

export async function getLocalCategoryById(id: string) {
  const database = await getLocalDb();

  return database.getFirstAsync<LocalCategory>(
    `
      select *
      from categories
      where id = ?;
    `,
    id
  );
}

export async function getLocalCategories(type?: LocalCategoryType) {
  const database = await getLocalDb();

  if (type) {
    return database.getAllAsync<LocalCategory>(
      `
        select *
        from categories
        where type = ?
        order by sort_order asc, name asc;
      `,
      type
    );
  }

  return database.getAllAsync<LocalCategory>(`
    select *
    from categories
    order by type asc, sort_order asc, name asc;
  `);
}

export async function updateLocalCategory(params: UpdateLocalCategoryParams) {
  const database = await getLocalDb();
  const currentCategory = await getLocalCategoryById(params.id);

  if (!currentCategory) {
    throw new Error('Локальная категория не найдена');
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
        sync_error = ?
      where id = ?;
    `,
    params.type ?? currentCategory.type,
    params.name?.trim() ?? currentCategory.name,
    params.color === undefined ? currentCategory.color : params.color,
    params.icon === undefined ? currentCategory.icon : params.icon,
    params.sortOrder ?? currentCategory.sort_order,
    new Date().toISOString(),
    'pending',
    null,
    params.id
  );

  const updatedCategory = await getLocalCategoryById(params.id);

  if (!updatedCategory) {
    throw new Error('Не удалось обновить локальную категорию');
  }

  return updatedCategory;
}

export async function deleteLocalCategory(id: string) {
  const database = await getLocalDb();

  await database.runAsync(
    `
      delete from categories
      where id = ?;
    `,
    id
  );
}

export async function getPendingLocalCategories() {
  const database = await getLocalDb();

  return database.getAllAsync<LocalCategory>(`
    select *
    from categories
    where sync_status in ('pending', 'failed')
    order by created_at asc;
  `);
}
