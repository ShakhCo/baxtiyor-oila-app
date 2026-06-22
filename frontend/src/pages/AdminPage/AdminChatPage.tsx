import { useEffect, useLayoutEffect, useRef, useState, type FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { Page } from '@/components/Page.tsx';
import { LabelSheet } from '@/components/LabelSheet/LabelSheet';
import { apiGet, apiPost } from '@/api/client';

import s from './AdminChatPage.module.css';
import sheet from '@/pages/ChatPage/ChatPage.module.css';

const LONG_PRESS_MS = 450;

type Item = {
  telegram_id: number;
  name: string;
  username: string;
  last_message: string;
  last_sender: 'user' | 'admin' | null;
  updated_at: string;
  unread: number;
  labels: string[];
};

type ChatsPayload = { items: Item[]; all_labels?: string[] };

const CHATS_KEY = ['admin-chats'] as const;
/** How long the inbox is reused before a refetch. */
const CHATS_STALE_MS = 15_000;

// UI state remembered across navigation (data itself is cached by React Query).
let cachedScrollY = 0;
let cachedFilter: string | null = null;
let cachedSearch = '';

function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';
}

// Uzbek short month names (Intl's uz-UZ data is unreliable in TG webviews).
const UZ_MONTHS = ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyun', 'Iyul', 'Avg', 'Sen', 'Okt', 'Noy', 'Dek'];

function timeLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  if (sameDay) {
    return d.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' });
  }
  // e.g. "Iyun 21"; include the year only when it isn't the current one
  const base = `${UZ_MONTHS[d.getMonth()]} ${d.getDate()}`;
  return d.getFullYear() === today.getFullYear() ? base : `${base}, ${d.getFullYear()}`;
}

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
      <path d="M16.5 16.5 L21 21" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function Chevron({ up }: { up: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d={up ? 'M6 15 L12 9 L18 15' : 'M6 9 L12 15 L18 9'}
        stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Custom smooth scroll with a fixed (fast) duration — native `smooth` crawls
// over the full height of a 700+ row list.
function fastScrollTo(targetY: number, duration = 480) {
  const startY = window.scrollY;
  const dist = targetY - startY;
  const start = performance.now();
  function step(now: number) {
    const t = Math.min(1, (now - start) / duration);
    const ease = 1 - Math.pow(1 - t, 3); // easeOutCubic
    window.scrollTo(0, startY + dist * ease);
    if (t < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

export const AdminChatPage: FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data, isSuccess } = useQuery({
    queryKey: CHATS_KEY,
    queryFn: () => apiGet<ChatsPayload>('/admin/chats'),
    staleTime: CHATS_STALE_MS,
    refetchInterval: CHATS_STALE_MS,
  });
  const items = data?.items ?? [];
  const allLabels = data?.all_labels ?? [];
  const loaded = isSuccess;

  const [filter, setFilter] = useState<string | null>(cachedFilter);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const [scrolledDown, setScrolledDown] = useState(false);
  const [search, setSearch] = useState(cachedSearch);
  const [searchOpen, setSearchOpen] = useState(cachedSearch.length > 0);
  const searchRef = useRef<HTMLInputElement>(null);
  const [labelTarget, setLabelTarget] = useState<Item | null>(null);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressedRef = useRef(false);

  // Long-press a row to assign labels without opening the chat.
  function startPress(it: Item) {
    longPressedRef.current = false;
    pressTimer.current = setTimeout(() => {
      longPressedRef.current = true;
      setLabelTarget(it);
    }, LONG_PRESS_MS);
  }
  function endPress() {
    if (pressTimer.current) { clearTimeout(pressTimer.current); pressTimer.current = null; }
  }

  useEffect(() => {
    const onScroll = () => setScrolledDown(window.scrollY > 500);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => { if (searchOpen) searchRef.current?.focus(); }, [searchOpen]);

  function onSearch(v: string) { cachedSearch = v; setSearch(v); }

  function toggleScroll() {
    fastScrollTo(scrolledDown ? 0 : document.documentElement.scrollHeight);
  }

  const q = search.trim().toLowerCase();
  const shown = items.filter(i => {
    if (filter && !(i.labels ?? []).includes(filter)) return false;
    if (q && !(
      i.name.toLowerCase().includes(q) ||
      (i.username ?? '').toLowerCase().includes(q) ||
      String(i.telegram_id).includes(q)
    )) return false;
    return true;
  });

  function selectFilter(label: string | null) {
    cachedFilter = label;
    setFilter(label);
  }

  function patchLabels(labels: string[]) {
    queryClient.setQueryData<ChatsPayload>(CHATS_KEY, (prev) =>
      prev ? { ...prev, all_labels: labels } : prev);
  }

  // update one row's labels in the cached list (after assigning via long-press)
  function patchItemLabels(id: number, labels: string[]) {
    queryClient.setQueryData<ChatsPayload>(CHATS_KEY, (prev) =>
      prev
        ? { ...prev, items: prev.items.map(it => (it.telegram_id === id ? { ...it, labels } : it)) }
        : prev);
  }

  async function addLabel() {
    const name = draft.trim();
    setAdding(false);
    setDraft('');
    if (!name || allLabels.includes(name)) return;
    patchLabels([...allLabels, name].sort((a, b) => a.localeCompare(b)));
    try {
      const res = await apiPost<{ labels: string[] }>('/admin/labels', { name });
      patchLabels(res.labels);
    } catch { /* keep optimistic */ }
  }

  // restore the scroll position we left on, and remember it when leaving
  useLayoutEffect(() => {
    if (cachedScrollY) window.scrollTo(0, cachedScrollY);
    return () => { cachedScrollY = window.scrollY; };
  }, []);

  function openChat(id: number) {
    cachedScrollY = window.scrollY;
    navigate(`/admin/chat/${id}`);
  }

  return (
    <Page back>
      <div className={s.root}>
        <div className={s.fadeTop} aria-hidden />
        <div className={s.fadeBottom} aria-hidden />

        <header className={s.header}>
          <p className={s.eyebrow}>
            {loaded ? `${items.length.toLocaleString('uz-UZ')} foydalanuvchi` : 'Foydalanuvchilar'}
          </p>
          <h1 className={s.title}>Suhbatlar</h1>
        </header>

        {loaded && (
          <div className={s.filterBar}>
            <div
              className={searchOpen ? `${s.search} ${s.searchOpen}` : s.search}
              onClick={() => { if (!searchOpen) setSearchOpen(true); }}
            >
              <span className={s.searchIcon}><SearchIcon /></span>
              <input
                ref={searchRef}
                className={s.searchInput}
                value={search}
                onChange={e => onSearch(e.target.value)}
                onBlur={() => { if (!search.trim()) setSearchOpen(false); }}
                onKeyDown={e => {
                  if (e.key === 'Enter') searchRef.current?.blur();
                  if (e.key === 'Escape') { onSearch(''); setSearchOpen(false); searchRef.current?.blur(); }
                }}
                placeholder="Qidirish…"
              />
            </div>
            <button
              type="button"
              className={!filter ? `${s.filterChip} ${s.filterActive}` : s.filterChip}
              onClick={() => selectFilter(null)}
            >
              Hammasi
            </button>
            {allLabels.map(l => (
              <button
                key={l}
                type="button"
                className={filter === l ? `${s.filterChip} ${s.filterActive}` : s.filterChip}
                onClick={() => selectFilter(l)}
              >
                {l}
              </button>
            ))}
            <button
              type="button"
              className={s.filterAdd}
              onClick={() => setAdding(true)}
              aria-label="Belgi qo‘shish"
            >
              +
            </button>
          </div>
        )}

        <div className={s.list}>
          {!loaded ? (
            Array.from({ length: 9 }).map((_, i) => (
              <div className={s.skel} key={i} aria-hidden>
                <span className={s.skelAvatar} />
                <span className={s.skelMain}>
                  <span className={s.skelLineWide} />
                  <span className={s.skelLine} />
                </span>
              </div>
            ))
          ) : shown.length === 0 ? (
            <p className={s.empty}>
              {q
                ? `“${search.trim()}” bo‘yicha hech narsa topilmadi.`
                : filter
                  ? `“${filter}” belgili foydalanuvchi yo‘q.`
                  : 'Hozircha suhbatlar yo‘q.'}
            </p>
          ) : (
            shown.map(it => (
              <button
                key={it.telegram_id}
                type="button"
                className={s.item}
                onPointerDown={() => startPress(it)}
                onPointerUp={endPress}
                onPointerCancel={endPress}
                onPointerLeave={endPress}
                onContextMenu={e => e.preventDefault()}
                onClick={() => {
                  if (longPressedRef.current) { longPressedRef.current = false; return; }
                  openChat(it.telegram_id);
                }}
              >
                <span className={s.avatar} aria-hidden>{initials(it.name)}</span>
                <span className={s.main}>
                  <span className={s.topline}>
                    <span className={s.name}>{it.name}</span>
                    <span className={s.time}>{timeLabel(it.updated_at)}</span>
                  </span>
                  <span className={s.previewLine}>
                    <span className={s.preview}>
                      {it.last_sender === 'admin' ? 'Siz: ' : ''}{it.last_message || '—'}
                    </span>
                    {it.unread > 0 && <span className={s.badge}>{it.unread}</span>}
                  </span>
                  {(it.labels?.length ?? 0) > 0 && (
                    <span className={s.labels}>
                      {it.labels.map(l => <span key={l} className={s.label}>{l}</span>)}
                    </span>
                  )}
                </span>
              </button>
            ))
          )}
        </div>

        {loaded && shown.length > 8 && (
          <button
            type="button"
            className={s.scrollBtn}
            onClick={toggleScroll}
            aria-label={scrolledDown ? 'Tepaga' : 'Pastga'}
          >
            <Chevron up={scrolledDown} />
          </button>
        )}

        {labelTarget && (
          <LabelSheet
            telegramId={labelTarget.telegram_id}
            initial={labelTarget.labels ?? []}
            allLabels={allLabels}
            onClose={() => setLabelTarget(null)}
            onSaved={(next) => patchItemLabels(labelTarget.telegram_id, next)}
          />
        )}

        {adding && (
          <div className={sheet.sheetBackdrop} onClick={() => { setAdding(false); setDraft(''); }}>
            <div className={sheet.sheet} onClick={e => e.stopPropagation()}>
              <h2 className={sheet.sheetTitle}>Yangi belgi</h2>
              <div className={sheet.addRow}>
                <input
                  className={sheet.labelInput}
                  value={draft}
                  autoFocus
                  onChange={e => setDraft(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') addLabel(); }}
                  placeholder="Belgi nomi…"
                  maxLength={40}
                />
                <button
                  type="button"
                  className={sheet.addBtn}
                  onClick={addLabel}
                  disabled={!draft.trim()}
                >
                  Qo‘shish
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Page>
  );
};
