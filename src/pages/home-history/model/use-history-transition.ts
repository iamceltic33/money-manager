import { useCallback, useEffect } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import { cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

export function useHistoryTransition({ expanded, enabled, onChange }: {
  expanded: boolean;
  enabled: boolean;
  onChange: (expanded: boolean) => void;
}) {
  const reducedMotion = useReducedMotion();
  const progress = useSharedValue(expanded ? 1 : 0);
  const summaryHeight = useSharedValue(0);
  const scrollY = useSharedValue(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const canClose = useSharedValue(false);
  const settling = useSharedValue(false);
  const dragging = useSharedValue(false);
  const distance = useSharedValue(160);

  useEffect(() => {
    cancelAnimation(progress);
    settling.set(false);
    progress.set(enabled
      ? withTiming(expanded ? 1 : 0, { duration: reducedMotion ? 0 : 220 })
      : expanded ? 1 : 0);
    return () => cancelAnimation(progress);
  }, [expanded, enabled, reducedMotion, progress, settling]);

  const commit = useCallback((next: boolean) => onChange(next), [onChange]);
  const pan = Gesture.Pan()
    .enabled(enabled)
    .manualActivation(true)
    .onTouchesDown((event, manager) => {
      if (settling.get() || event.allTouches.length !== 1) { manager.fail(); return; }
      startX.set(event.allTouches[0].absoluteX);
      startY.set(event.allTouches[0].absoluteY);
      canClose.set(scrollY.get() <= 1);
      dragging.set(false);
      distance.set(Math.max(120, Math.min(240, summaryHeight.get() * 0.65)));
    })
    .onTouchesMove((event, manager) => {
      if (event.allTouches.length !== 1) { manager.fail(); return; }
      const dx = event.allTouches[0].absoluteX - startX.get();
      const dy = event.allTouches[0].absoluteY - startY.get();
      if (Math.abs(dx) > 12 && Math.abs(dx) >= Math.abs(dy)) { manager.fail(); return; }
      if (Math.abs(dy) < 12) return;
      if ((!expanded && dy < 0) || (expanded && canClose.get() && dy > 0)) manager.activate();
      else manager.fail();
    })
    .onTouchesUp((_event, manager) => { if (!dragging.get()) manager.fail(); })
    .onStart(() => { dragging.set(true); })
    .onUpdate(event => {
      if (!reducedMotion) progress.set(Math.max(0, Math.min(1, (expanded ? 1 : 0) - event.translationY / distance.get())));
    })
    .onEnd(event => {
      const travel = expanded ? event.translationY : -event.translationY;
      const velocity = expanded ? event.velocityY : -event.velocityY;
      const next = travel >= distance.get() * 0.45 || (travel >= 24 && velocity >= 800) ? !expanded : expanded;
      settling.set(true);
      progress.set(withTiming(next ? 1 : 0, { duration: reducedMotion ? 0 : 180 }, finished => {
        if (finished) {
          settling.set(false);
          if (next !== expanded) scheduleOnRN(commit, next);
        }
      }));
    })
    .onFinalize((_event, success) => {
      dragging.set(false);
      if (!success && !settling.get()) progress.set(withTiming(expanded ? 1 : 0, { duration: reducedMotion ? 0 : 180 }));
    });
  // The list waits for the directional decision, then scrolls normally if the pan fails.
  const native = Gesture.Native().requireExternalGestureToFail(pan);
  const summaryStyle = useAnimatedStyle(() => ({
    height: summaryHeight.get() * (1 - progress.get()),
    marginBottom: 16 * (1 - progress.get()),
    opacity: 1 - progress.get(),
    transform: [{ scale: reducedMotion ? 1 : 1 - progress.get() * 0.08 }],
  }));
  const homeHeaderStyle = useAnimatedStyle(() => ({ opacity: 1 - progress.get() }));
  const historyHeaderStyle = useAnimatedStyle(() => ({ opacity: progress.get() }));

  const measureSummary = (height: number) => {
    if (height > 0) summaryHeight.set(height);
  };
  const updateScroll = (offset: number) => { scrollY.set(offset); };
  return { pan, native, measureSummary, updateScroll, summaryStyle, homeHeaderStyle, historyHeaderStyle };
}
