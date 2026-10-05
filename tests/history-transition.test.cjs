const assert = require('node:assert/strict');
const { test } = require('node:test');
const { load } = require('./sync-helpers.cjs');

function setup(expanded = false, reducedMotion = false, enabled = true) {
  const changes = [];
  const animations = [];
  const builder = () => {
    const callbacks = {};
    const gesture = { callbacks };
    for (const name of ['enabled', 'manualActivation', 'requireExternalGestureToFail']) {
      gesture[name] = value => { gesture[name + 'Value'] = value; return gesture; };
    }
    for (const name of ['onTouchesDown', 'onTouchesMove', 'onTouchesUp', 'onStart', 'onUpdate', 'onEnd', 'onFinalize']) {
      gesture[name] = callback => { callbacks[name] = callback; return gesture; };
    }
    return gesture;
  };
  const { useHistoryTransition: evaluateTransition } = load('src/pages/home-history/model/use-history-transition.ts', {
    react: { useCallback: callback => callback, useEffect: callback => callback() },
    'react-native-gesture-handler': { Gesture: { Pan: builder, Native: builder } },
    'react-native-reanimated': {
      cancelAnimation: () => {},
      useReducedMotion: () => reducedMotion,
      useSharedValue: initial => {
        let value = initial;
        return { get: () => value, set: next => { value = next; } };
      },
      useAnimatedStyle: callback => callback,
      withTiming: (value, options, callback) => { animations.push({ value, options, callback }); return value; },
    },
    'react-native-worklets': { scheduleOnRN: (callback, ...args) => callback(...args) },
  });
  const result = evaluateTransition({ expanded, enabled, onChange: value => changes.push(value) });
  result.measureSummary(300);
  const decisions = [];
  const manager = { fail: () => decisions.push('fail'), activate: () => decisions.push('activate') };
  const touch = (x, y) => ({ allTouches: [{ absoluteX: x, absoluteY: y }] });
  const start = (offset = 0) => {
    result.updateScroll(offset);
    result.pan.callbacks.onTouchesDown(touch(100, 100), manager);
  };
  return { ...result, changes, animations, decisions, manager, touch, start, callbacks: result.pan.callbacks };
}

test('upward pull opens only after settling; short pull cancels; fast flick opens', () => {
  for (const [translationY, velocityY, opens] of [[-100, 0, true], [-30, 0, false], [-30, -900, true], [-15, -900, false]]) {
    const s = setup();
    s.start();
    s.callbacks.onTouchesMove(s.touch(100, 80), s.manager);
    assert.deepEqual(s.decisions, ['activate']);
    s.callbacks.onStart();
    s.callbacks.onUpdate({ translationY });
    s.callbacks.onEnd({ translationY, velocityY });
    assert.deepEqual(s.changes, []);
    s.animations.at(-1).callback(true);
    assert.deepEqual(s.changes, opens ? [true] : []);
  }
});

test('history closes only when the gesture starts at top; ordinary scroll and horizontal movements fail pan', () => {
  for (const [expanded, offset, x, y, expected] of [[true, 0, 100, 130, 'activate'], [true, 40, 100, 130, 'fail'], [true, 0, 100, 70, 'fail'], [false, 0, 130, 103, 'fail']]) {
    const s = setup(expanded);
    s.start(offset);
    s.callbacks.onTouchesMove(s.touch(x, y), s.manager);
    assert.deepEqual(s.decisions, [expected]);
    assert.equal(s.native.requireExternalGestureToFailValue, s.pan);
  }
  const s = setup(true);
  s.start();
  s.callbacks.onEnd({ translationY: 120, velocityY: 0 });
  s.animations.at(-1).callback(true);
  assert.deepEqual(s.changes, [false]);
});

test('closing history restores full summary height, opacity and scale; zero layout cannot erase measurement', () => {
  const s = setup(true);
  assert.equal(s.summaryStyle().height, 0);
  s.measureSummary(0);
  s.start();
  s.callbacks.onStart();
  s.callbacks.onUpdate({ translationY: 80 });
  assert.ok(s.summaryStyle().height > 0 && s.summaryStyle().height < 300);
  s.callbacks.onEnd({ translationY: 120, velocityY: 0 });
  s.animations.at(-1).callback(true);
  assert.deepEqual(s.changes, [false]);
  assert.equal(s.summaryStyle().height, 300);
  assert.equal(s.summaryStyle().opacity, 1);
  assert.equal(s.summaryStyle().transform[0].scale, 1);
});

test('cancelled/interrupted animation cannot navigate; taps fail without activating; reduced motion skips scaling', () => {
  const s = setup();
  s.start();
  s.callbacks.onTouchesUp({}, s.manager);
  assert.deepEqual(s.decisions, ['fail']);
  s.callbacks.onEnd({ translationY: -120, velocityY: 0 });
  s.animations.at(-1).callback(false);
  assert.deepEqual(s.changes, []);
  const cancelled = setup();
  cancelled.start();
  cancelled.callbacks.onStart();
  cancelled.callbacks.onUpdate({ translationY: -80 });
  cancelled.callbacks.onFinalize({}, false);
  assert.equal(cancelled.animations.at(-1).value, 0);
  const count = s.animations.length;
  s.callbacks.onFinalize({}, false);
  assert.equal(s.animations.length, count);
  assert.equal(s.animations.at(-1).value, 1);
  const reduced = setup(false, true);
  reduced.start();
  reduced.callbacks.onUpdate({ translationY: -120 });
  assert.equal(reduced.summaryStyle().transform[0].scale, 1);
  reduced.callbacks.onEnd({ translationY: -120, velocityY: 0 });
  assert.equal(reduced.animations.at(-1).options.duration, 0);
  assert.equal(setup(false, false, false).pan.enabledValue, false);
});
