type WheelDelta = { deltaX: number; deltaY: number; deltaMode: number; ctrlKey: boolean };

// A short burst opens history once; horizontal scroll and browser zoom are ignored.
export function createHistoryWheel() {
  let total = 0;
  let lastTime = 0;
  let opened = false;
  return {
    reset: () => { total = 0; lastTime = 0; opened = false; },
    update: (event: WheelDelta, now: number) => {
      if (opened || event.ctrlKey || Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return false;
      if (now - lastTime > 200) total = 0;
      lastTime = now;
      const factor = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 800 : 1;
      total = Math.max(0, total + event.deltaY * factor);
      if (total < 80) return false;
      opened = true;
      return true;
    },
  };
}
