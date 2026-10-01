import { create } from 'zustand';

type SyncState = {
  activeUsers: Record<string, boolean>;
  setActive: (userId: string, active: boolean) => void;
};

export const useSyncStore = create<SyncState>(set => ({
  activeUsers: {},
  setActive: (userId, active) => set(state => {
    const activeUsers = { ...state.activeUsers };
    if (active) activeUsers[userId] = true;
    else delete activeUsers[userId];
    return { activeUsers };
  }),
}));
