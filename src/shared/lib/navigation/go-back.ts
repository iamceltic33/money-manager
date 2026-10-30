import type { useRouter } from 'expo-router';

const mainRoutes = new Set(['/', '/categories', '/obligations', '/forecasts', '/profile']);

export function isMainRoute(pathname: string) {
  return mainRoutes.has(pathname);
}

export function goBack(router: Pick<ReturnType<typeof useRouter>, 'back' | 'canDismiss' | 'dismissTo' | 'replace'>, pathname: string) {
  if (isMainRoute(pathname) || pathname === '/transactions') {
    router.dismissTo('/');
    return;
  }

  // /add-operation returns to its caller (including credits) when stack history exists.
  // A direct form link without stack history falls back to home below.
  // A tab can handle "back" even when a directly opened screen has no stack history.
  if (router.canDismiss()) {
    router.back();
    return;
  }

  const edit = pathname.match(/^\/transactions\/([^/]+)\/edit$/);
  if (edit) {
    router.replace({ pathname: '/transactions/[id]', params: { id: decodeURIComponent(edit[1]) } });
  } else {
    router.replace(pathname.startsWith('/transactions/') ? '/transactions' : '/');
  }
}
