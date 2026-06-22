import { useEffect, useLayoutEffect, useRef, useState, type FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';

import { Page } from '@/components/Page.tsx';
import { LabelSheet } from '@/components/LabelSheet/LabelSheet';
import { apiGet, apiPost } from '@/api/client';

import s from './AdminChatPage.module.css';
import sheet from '@/pages/ChatPage/ChatPage.module.css';

const PAGE_SIZE = 15;
const LONG_PRESS_MS = 450;
const CHATS_KEY = 'admin-chats';
const LABELS_KEY = ['admin-labels'] as const;

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
type ChatsPage = { items: Item[]; has_more: boolean; total: number };
type InfiniteChats = { pages: ChatsPage[]; pageParams: number[] };

// UI state remembered across navigation (the data itself is cached by React Query).
let cachedScrollY = 0;
let cachedFilter: string | null = null;
let cachedSearch = '';

function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';
}

const UZ_MONTHS = ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyun', 'Iyul', 'Avg', 'Sen', 'Okt', 'Noy', 'Dek'];

function timeLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) {
    return d.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' });
  }
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

function SendIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M21 3 L11 13 M21 3 L14.5 21 L11 13 L3 9.5 Z"
        stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function ArrowUpIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M6 15 L12 9 L18 15" stroke="currentColor" strokeWidth="2.2"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function fastScrollTo(targetY: number, duration = 420) {
  const startY = window.scrollY;
  const dist = targetY - startY;
  const start = performance.now();
  function step(now: number) {
    const t = Math.min(1, (now - start) / duration);
    const ease = 1 - Math.pow(1 - t, 3);
    window.scrollTo(0, startY + dist * ease);
    if (t < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

export const AdminChatPage: FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [filter, setFilter] = useState<string | null>(cachedFilter);
  const [search, setSearch] = useState(cachedSearch);
  const [debouncedSearch, setDebouncedSearch] = useState(cachedSearch.trim());
  const [searchOpen, setSearchOpen] = useState(cachedSearch.length > 0);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const [scrolledDown, setScrolledDown] = useState(false);
  const [labelTarget, setLabelTarget] = useState<Item | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressedRef = useRef(false);

  // global labels live in their own query so the chat pages don't re-fetch them
  const labelsQuery = useQuery({
    queryKey: LABELS_KEY,
    queryFn: () => apiGet<{ labels: string[] }>('/admin/labels'),
    staleTime: 30_000,
  });
  const allLabels = labelsQuery.data?.labels ?? [];

  // debounce the (server-side) search so we don't query on every keystroke
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  const chats = useInfiniteQuery({
    queryKey: [CHATS_KEY, filter ?? '', debouncedSearch],
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ offset: String(pageParam), limit: String(PAGE_SIZE) });
      if (filter) params.set('label', filter);
      if (debouncedSearch) params.set('q', debouncedSearch);
      return apiGet<ChatsPage>(`/admin/chats?${params.toString()}`);
    },
    initialPageParam: 0,
    getNextPageParam: (last, all) => (last.has_more ? all.length * PAGE_SIZE : undefined),
    staleTime: 15_000,
    refetchInterval: 15_000,
  });

  const items = chats.data?.pages.flatMap(p => p.items) ?? [];
  const total = chats.data?.pages[0]?.total ?? 0;
  const loaded = !!chats.data;

  // load the next page when the sentinel scrolls into view
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && chats.hasNextPage && !chats.isFetchingNextPage) {
        chats.fetchNextPage();
      }
    }, { rootMargin: '400px' });
    io.observe(el);
    return () => io.disconnect();
  }, [chats.hasNextPage, chats.isFetchingNextPage, chats.fetchNextPage, items.length]);

  useEffect(() => {
    const onScroll = () => setScrolledDown(window.scrollY > 600);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => { if (searchOpen) searchRef.current?.focus(); }, [searchOpen]);

  function onSearch(v: string) { cachedSearch = v; setSearch(v); }
  function selectFilter(label: string | null) { cachedFilter = label; setFilter(label); }

  function patchLabels(labels: string[]) {
    queryClient.setQueryData<{ labels: string[] }>(LABELS_KEY, { labels });
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

  // update one row's labels everywhere it's cached (across filter/search variants)
  function patchItemLabels(id: number, labels: string[]) {
    queryClient.setQueriesData<InfiniteChats>({ queryKey: [CHATS_KEY] }, (old) =>
      old?.pages
        ? {
            ...old,
            pages: old.pages.map(p => ({
              ...p,
              items: p.items.map(it => (it.telegram_id === id ? { ...it, labels } : it)),
            })),
          }
        : old);
  }

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
          <div>
            <p className={s.eyebrow}>
              {loaded ? `${total.toLocaleString('uz-UZ')} foydalanuvchi` : 'Foydalanuvchilar'}
            </p>
            <h1 className={s.title}>Suhbatlar</h1>
          </div>
          <button
            type="button"
            className={s.broadcastBtn}
            onClick={() => navigate('/admin/broadcast')}
            aria-label="Ommaviy xabar"
          >
            <SendIcon />
          </button>
        </header>

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
          ) : items.length === 0 ? (
            <p className={s.empty}>
              {debouncedSearch
                ? `“${debouncedSearch}” bo‘yicha hech narsa topilmadi.`
                : filter
                  ? `“${filter}” belgili foydalanuvchi yo‘q.`
                  : 'Hozircha suhbatlar yo‘q.'}
            </p>
          ) : (
            <>
              {items.map(it => (
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
              ))}

              {/* infinite-scroll trigger + loading rows */}
              <div ref={sentinelRef} aria-hidden />
              {chats.isFetchingNextPage && Array.from({ length: 3 }).map((_, i) => (
                <div className={s.skel} key={`more-${i}`} aria-hidden>
                  <span className={s.skelAvatar} />
                  <span className={s.skelMain}>
                    <span className={s.skelLineWide} />
                    <span className={s.skelLine} />
                  </span>
                </div>
              ))}
            </>
          )}
        </div>

        {scrolledDown && (
          <button
            type="button"
            className={s.scrollBtn}
            onClick={() => fastScrollTo(0)}
            aria-label="Tepaga"
          >
            <ArrowUpIcon />
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
