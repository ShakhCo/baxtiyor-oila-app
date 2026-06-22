import { type FC } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import s from './BottomNav.module.css';

function HomeIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 11 L12 4 L20 11 M6 9.5 V20 H18 V9.5" stroke="currentColor"
        strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M6 4 H18 A2 2 0 0 1 20 6 V14 A2 2 0 0 1 18 16 H10 L6 20 V6 A2 2 0 0 1 6 4 Z"
        stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const TABS = [
  { path: '/', label: 'Asosiy', Icon: HomeIcon },
  { path: '/chat', label: 'Suhbat', Icon: ChatIcon },
];

export const BottomNav: FC<{ fixed?: boolean }> = ({ fixed }) => {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return (
    <>
      {fixed && <div className={s.fade} aria-hidden />}
      <nav className={fixed ? `${s.nav} ${s.fixed}` : s.nav}>
        {TABS.map(({ path, label, Icon }) => {
        const active = pathname === path;
        return (
          <button
            key={path}
            type="button"
            className={active ? `${s.tab} ${s.active}` : s.tab}
            onClick={() => navigate(path)}
            aria-current={active ? 'page' : undefined}
          >
            <Icon />
            <span className={s.label}>{label}</span>
          </button>
        );
        })}
      </nav>
    </>
  );
};
