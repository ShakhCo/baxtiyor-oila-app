import { useEffect, useState, type FC } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { apiGet } from '@/api/client';

import s from './BottomNav.module.css';

// The top-level destinations that present the tab bar. Detail / thread views
// (e.g. /admin/chat/:id) are reached via the back button and show no bar.
const TAB_ROUTES = new Set(['/', '/anketa', '/chat']);

type IconProps = { active: boolean };

function HomeIcon({ active }: IconProps) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M3.5 11.2 12 4l8.5 7.2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5.4 9.8V19a1 1 0 0 0 1 1H17.6a1 1 0 0 0 1-1V9.8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      {active && <path d="M9.6 20v-4.6a1 1 0 0 1 1-1h2.8a1 1 0 0 1 1 1V20" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />}
    </svg>
  );
}

function AnketaIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="5" y="3.5" width="14" height="17" rx="2.4" stroke="currentColor" strokeWidth="1.7" />
      <path d="M8.6 8.5h6.8M8.6 12h6.8M8.6 15.5h4.2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 6.6A2.6 2.6 0 0 1 6.6 4h10.8A2.6 2.6 0 0 1 20 6.6v7.2a2.6 2.6 0 0 1-2.6 2.6H9l-4 3.4v-3.4H6.6"
        stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

type Tab = { key: string; label: string; to: string; Icon: FC<IconProps> };

export const BottomNav: FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);

  // Mounted once (outside <Routes>), so this runs a single time per launch.
  useEffect(() => {
    apiGet<{ is_admin: boolean }>('/me')
      .then(d => setIsAdmin(Boolean(d.is_admin)))
      .catch(() => { /* not admin / auth hiccup — user targets are fine */ });
  }, []);

  const path = location.pathname;
  if (!TAB_ROUTES.has(path)) return null;

  // Admins reach the review queue and the support inbox through the same two
  // tabs, so the bar works for both roles without a separate admin entry.
  const tabs: Tab[] = [
    { key: 'home',   label: 'Asosiy', to: '/',                            Icon: HomeIcon },
    { key: 'anketa', label: 'Anketa', to: isAdmin ? '/admin' : '/anketa', Icon: AnketaIcon },
    { key: 'chat',   label: 'Suhbat', to: isAdmin ? '/admin/chat' : '/chat', Icon: ChatIcon },
  ];

  const activeKey =
    path === '/' ? 'home' : path === '/anketa' ? 'anketa' : path === '/chat' ? 'chat' : '';

  return (
    <nav className={s.nav} aria-label="Asosiy navigatsiya">
      {tabs.map(({ key, label, to, Icon }) => {
        const on = key === activeKey;
        return (
          <button
            key={key}
            type="button"
            className={on ? `${s.item} ${s.active}` : s.item}
            onClick={() => { if (!on) navigate(to); }}
            aria-current={on ? 'page' : undefined}
          >
            <Icon active={on} />
            <span className={s.label}>{label}</span>
          </button>
        );
      })}
    </nav>
  );
};
