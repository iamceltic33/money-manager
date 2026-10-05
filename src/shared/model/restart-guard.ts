import { create } from 'zustand';

export const useRestartGuard = create<{ activeTasks: number; restarting: boolean }>(() => ({
  activeTasks: 0,
  restarting: false,
}));

export const beginAppTask = () => {
  if (useRestartGuard.getState().restarting) {
    throw new Error('Приложение перезапускается. Повторите действие после обновления.');
  }
  useRestartGuard.setState(state => ({ activeTasks: state.activeTasks + 1 }));
  let finished = false;
  return () => {
    if (finished) return;
    finished = true;
    useRestartGuard.setState(state => ({ activeTasks: state.activeTasks - 1 }));
  };
};

export const tryBeginRestart = () => {
  const state = useRestartGuard.getState();
  if (state.activeTasks > 0 || state.restarting) return false;
  useRestartGuard.setState({ restarting: true });
  return true;
};

export const cancelRestart = () => useRestartGuard.setState({ restarting: false });
