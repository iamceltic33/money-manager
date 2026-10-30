const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { load } = require('./sync-helpers.cjs');
const { goBack } = load('src/shared/lib/navigation/go-back.ts');

function redirectEntry(legacyPath, params = {}, caller) {
  const stack = caller ? [caller, legacyPath] : [legacyPath];
  const calls = [];
  const router = {
    replace(href) {
      calls.push(['replace', href]);
      stack[stack.length - 1] = href;
    },
    canDismiss: () => stack.length > 1,
    back: () => stack.pop(),
    push: () => { throw new Error('Entry redirect must not push'); },
  };
  // Exercise the installed Expo Redirect implementation with focus/router adapters.
  const redirectExports = {};
  const redirectModules = {
    '../hooks': { useRouter: () => router },
    '../useFocusEffect': { useFocusEffect: callback => callback() },
    './preview/PreviewRouteContext': { useIsPreview: () => false },
  };
  vm.runInNewContext(readFileSync('node_modules/expo-router/build/link/Redirect.js', 'utf8'), {
    exports: redirectExports,
    require: name => { assert.ok(name in redirectModules, name); return redirectModules[name]; },
    console: { error: error => { throw error; } },
  });
  const exports = {};
  const modules = {
    'expo-router': { Redirect: redirectExports.Redirect, useLocalSearchParams: () => params },
    'react/jsx-runtime': { jsx: (type, props) => ({ type, props }) },
  };
  vm.runInNewContext(ts.transpileModule(readFileSync(`src/app/(app)/(operations)${legacyPath}.tsx`, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { exports, require: name => { assert.ok(name in modules, name); return modules[name]; } });
  const element = exports.default();
  assert.equal(element.type, redirectExports.Redirect);
  element.type(element.props);
  return { stack, calls, router, href: JSON.parse(JSON.stringify(element.props.href)) };
}

test('legacy expense preserves paymentId and forces expense regardless of unrelated params', () => {
  for (const paymentId of ['payment', ['payment', 'second']]) {
    const f = redirectEntry('/add-expense', { paymentId, type: 'income', unrelated: 'ignored' }, '/obligations');
    assert.deepEqual(f.href, { pathname: '/add-operation', params: { type: 'expense', paymentId: 'payment' } });
    assert.equal(f.calls[0][0], 'replace');
    assert.equal(f.stack.length, 2);
    goBack(f.router, '/add-operation');
    assert.deepEqual(f.stack, ['/obligations']);
  }
});

test('home expense and income links replace the entry and return directly to home', () => {
  for (const type of ['expense', 'income']) {
    const f = redirectEntry(`/add-${type}`, { paymentId: type === 'income' ? 'ignored' : '' }, '/');
    assert.deepEqual(f.href, { pathname: '/add-operation', params: { type } });
    assert.equal(f.calls.length, 1);
    assert.equal(f.stack.length, 2);
    goBack(f.router, '/add-operation');
    assert.deepEqual(f.stack, ['/']);
  }
});

test('direct legacy URLs without stack history return home without reopening the entry', () => {
  for (const type of ['expense', 'income']) {
    const f = redirectEntry(`/add-${type}`);
    assert.deepEqual(f.href, { pathname: '/add-operation', params: { type } });
    assert.equal(f.stack.length, 1);
    goBack(f.router, '/add-operation');
    assert.deepEqual(f.stack, ['/']);
    assert.equal(f.calls.every(([method]) => method === 'replace'), true);
  }
});
