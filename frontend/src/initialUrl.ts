// Snapshot the launch URL the instant the app boots, before HashRouter or the
// Telegram SDK can rewrite window.location. Telegram delivers the deep-link
// start parameter (tgWebAppStartParam) in the URL *query string* for
// direct-link / Main Mini App launches — not the hash — so this is where we can
// reliably find it. Imported first in index.tsx.
export const INITIAL_SEARCH = window.location.search;
export const INITIAL_HASH = window.location.hash;

/** Pull tgWebAppStartParam out of the captured launch URL (query, then hash). */
export function initialStartParam(): string | undefined {
  for (const raw of [INITIAL_SEARCH, INITIAL_HASH]) {
    if (!raw) continue;
    // strip a leading "#", "?", or "#/" before parsing as query params
    const cleaned = raw.replace(/^[#?]\/?/, '');
    const value = new URLSearchParams(cleaned).get('tgWebAppStartParam');
    if (value) return value;
  }
  return undefined;
}
