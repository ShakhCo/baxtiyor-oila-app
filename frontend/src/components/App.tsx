import { useEffect } from 'react';
import { Navigate, Route, Routes, HashRouter, useNavigate } from 'react-router-dom';
import { useLaunchParams, useSignal, miniApp, initData, retrieveLaunchParams } from '@tma.js/sdk-react';
import { AppRoot } from '@telegram-apps/telegram-ui';

import { routes } from '@/navigation/routes.tsx';
import { initialStartParam } from '@/initialUrl.ts';

// Read the launch deep-link param. For a direct-link / Main Mini App
// (t.me/bot?startapp=…) Telegram puts tgWebAppStartParam in the URL *query
// string* — which the SDK's hash parser misses — so the captured launch URL is
// the primary source. Init data only carries start_param for attachment-menu
// launches. We check all sources to be safe.
function readStartParam(): string | undefined {
  const fromUrl = initialStartParam();
  if (fromUrl) return fromUrl;
  try {
    const v = retrieveLaunchParams().tgWebAppStartParam;
    if (v) return v;
  } catch { /* not available */ }
  try {
    const v = initData.startParam();
    if (v) return v;
  } catch { /* init data not mounted */ }
  return undefined;
}

// Deep-link target from a `startapp=chat_<id>` launch, resolved once at startup.
const START_TARGET: string | null = (() => {
  const m = /^chat_(\d+)$/.exec(readStartParam() ?? '');
  return m ? `/admin/chat/${m[1]}` : null;
})();
// Module-level so it survives StrictMode's double-mount: the deep link is
// honoured exactly once, after which a genuine 404 falls back home.
let deepLinkDone = false;

// Back stack seeded under a deep link so Telegram's back button (navigate -1)
// walks thread → list → home, instead of dead-ending on the entry page.
const START_STACK = ['/', '/admin/chat'];

// Honours the deep link once on launch. Replaces the entry page with home, then
// pushes the chat list and the thread — so back goes list, then home. Runs for
// every launch shape (matched route or the catch-all below), so it's the single
// source of deep-link navigation; nothing competes with it.
function StartParamRedirect() {
  const navigate = useNavigate();
  useEffect(() => {
    if (START_TARGET && !deepLinkDone) {
      deepLinkDone = true;
      navigate(START_STACK[0], { replace: true });
      for (const path of START_STACK.slice(1)) navigate(path);
      navigate(START_TARGET);
    }
  }, [navigate]);
  return null;
}

// Rendered when NO route matched on launch — on a real device the hash holds
// Telegram's launch params (#tgWebAppData=…), so this runs. While a deep link is
// pending, render nothing and let the effect above own the navigation (so we
// don't seed a competing "/" entry); otherwise a genuine 404 goes home.
function CatchAll() {
  if (START_TARGET && !deepLinkDone) return null;
  return <Navigate to="/" replace />;
}

export function App() {
  const lp = useLaunchParams();
  const isDark = useSignal(miniApp.isDark);

  return (
    <AppRoot
      appearance={isDark ? 'dark' : 'light'}
      platform={['macos', 'ios'].includes(lp.tgWebAppPlatform) ? 'ios' : 'base'}
    >
      <HashRouter>
        <StartParamRedirect />
        <Routes>
          {routes.map((route) => <Route key={route.path} {...route} />)}
          <Route path="*" element={<CatchAll />}/>
        </Routes>
      </HashRouter>
    </AppRoot>
  );
}
