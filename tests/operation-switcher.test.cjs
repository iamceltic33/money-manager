const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function fixture(pathname = '/', props = {}) {
  const pushes = [];
  let pathnameReads = 0;
  const jsx = (type, props) => ({ type, props });
  const modules = {
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'expo-router': {
      router: { push: path => pushes.push(path) },
      usePathname: () => { pathnameReads++; return pathname; },
    },
    'lucide-react-native': { Minus: 'Minus', Plus: 'Plus' },
    'react-native': { Pressable: 'Pressable', View: 'View', StyleSheet: { create: styles => styles } },
    '@/shared/config/theme': { MaxContentWidth: 600, Spacing: {} },
    '@/shared/lib/theme/use-theme': { useTheme: () => ({ backgroundElement: 'element', background: 'active', textSecondary: 'secondary' }) },
    '@/shared/ui/themed-text': { ThemedText: 'Text' },
  };
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync('src/widgets/operation-switcher/ui/operation-switcher.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { exports, require: name => { assert.ok(name in modules, name); return modules[name]; } });
  return {
    pushes,
    props,
    get pathnameReads() { return pathnameReads; },
    render() {
      let node = exports.OperationSwitcher(props);
      while (typeof node.type === 'function') node = node.type(node.props);
      return node.props.children.map(child => child.props);
    },
  };
}

test('controlled switcher requests a type change without reading or changing the route', () => {
  const changes = [];
  const f = fixture('/add-operation', { type: 'expense', onTypeChange: type => changes.push(type) });
  let buttons = f.render();
  assert.equal(buttons[0].accessibilityState.selected, true);
  assert.equal(buttons[1].accessibilityState.selected, false);
  buttons[1].onPress();
  assert.deepEqual(changes, ['income']);
  // The owner decides when to apply the requested type.
  assert.equal(f.render()[0].accessibilityState.selected, true);
  f.props.type = 'income';
  buttons = f.render();
  assert.equal(buttons[1].accessibilityState.selected, true);
  buttons[0].onPress();
  assert.deepEqual(changes, ['income', 'expense']);
  assert.deepEqual(f.pushes, []);
  assert.equal(f.pathnameReads, 0);
});

test('pressing the selected controlled type does not request a reset', () => {
  let changes = 0;
  for (const [index, type] of ['expense', 'income'].entries()) {
    const f = fixture('/', { type, onTypeChange: () => { changes++; } });
    f.render()[index].onPress();
    assert.equal(changes, 0);
  }
});

test('disabled controlled switcher blocks both actions and can be enabled again', () => {
  const changes = [];
  const f = fixture('/', { type: 'expense', onTypeChange: type => changes.push(type), disabled: true });
  for (const button of f.render()) {
    assert.equal(button.disabled, true);
    assert.equal(button.accessibilityState.disabled, true);
    button.onPress();
  }
  assert.deepEqual(changes, []);
  f.props.disabled = false;
  const income = f.render()[1];
  assert.equal(income.disabled, false);
  income.onPress();
  assert.deepEqual(changes, ['income']);
  assert.deepEqual(f.pushes, []);
});

test('legacy navigation mode keeps home links and route-based selection', () => {
  for (const pathname of ['/', '/add-expense', '/add-income']) {
    const f = fixture(pathname);
    const buttons = f.render();
    assert.equal(buttons[0].accessibilityState.selected, pathname === '/add-expense');
    assert.equal(buttons[1].accessibilityState.selected, pathname === '/add-income');
    buttons[0].onPress();
    buttons[1].onPress();
    assert.deepEqual(f.pushes, ['/add-expense', '/add-income']);
    assert.equal(f.pathnameReads, 1);
  }
});
