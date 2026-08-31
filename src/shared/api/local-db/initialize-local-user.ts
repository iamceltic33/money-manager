import { getLocalDb } from './client';

type LocalUserRow = {
  id: string;
};

type PresetCategory = {
  type: 'income' | 'expense';
  name: string;
  color: string;
  icon: string;
  sortOrder: number;
};

const PRESET_CATEGORIES: PresetCategory[] = [
  {
    type: 'income',
    name: 'Зарплата',
    color: '#16A34A',
    icon: 'salary',
    sortOrder: 10,
  },
  {
    type: 'income',
    name: 'Подарок',
    color: '#DB2777',
    icon: 'gift',
    sortOrder: 20,
  },
  {
    type: 'expense',
    name: 'Покупки',
    color: '#DC2626',
    icon: 'shopping',
    sortOrder: 10,
  },
  {
    type: 'expense',
    name: 'Кредиты',
    color: '#7C3AED',
    icon: 'bank',
    sortOrder: 20,
  },
  {
    type: 'expense',
    name: 'Платежи',
    color: '#CA8A04',
    icon: 'receipt',
    sortOrder: 30,
  },
  {
    type: 'expense',
    name: 'Еда',
    color: '#0EA5E9',
    icon: 'food',
    sortOrder: 40,
  },
  {
    type: 'expense',
    name: 'Транспорт',
    color: '#2563EB',
    icon: 'transport',
    sortOrder: 50,
  },
];

function createLocalId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export async function initializeLocalUser(userId: string) {
  const database = await getLocalDb();
  const now = new Date().toISOString();

  await database.withTransactionAsync(async () => {
    const localUser = await database.getFirstAsync<LocalUserRow>(
      `
        select id
        from local_users
        where id = ?;
      `,
      userId
    );

    if (localUser) return;

    await database.runAsync(
      `
        insert into local_users (
          id,
          created_at,
          initialized_at
        )
        values (?, ?, ?);
      `,
      userId,
      now,
      now
    );

    for (const presetCategory of PRESET_CATEGORIES) {
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
            sync_error
          )
          values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        `,
        createLocalId(),
        userId,
        null,
        presetCategory.type,
        presetCategory.name,
        presetCategory.color,
        presetCategory.icon,
        presetCategory.sortOrder,
        now,
        now,
        'pending',
        null
      );
    }
  });
}
