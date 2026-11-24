/**
 * Replaces the current URL (e.g. to reflect filter state) without a navigation.
 *
 * Unlike a bare `window.history.replaceState({}, "", url)`, this keeps the
 * Next.js router state (`__N`, `key`, `options`) on the history entry and only
 * updates its `url`/`as`. The pages router ignores popstate events for entries
 * without `__N`, so wiping that state breaks the browser back button when
 * returning to this page from another one.
 */
export const replaceUrlKeepingRouterState = (url: string): void => {
  const { pathname, search, hash } = new URL(url, window.location.href);
  const path = `${pathname}${search}${hash}`;
  const state = window.history.state;
  const newState = state?.__N ? { ...state, url: path, as: path } : state;
  window.history.replaceState(newState, "", path);
};
