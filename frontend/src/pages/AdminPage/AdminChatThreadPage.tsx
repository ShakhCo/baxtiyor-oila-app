import { useEffect, useState, type FC } from 'react';
import { useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';

import { Page } from '@/components/Page.tsx';
import { ChatThread, type ChatMessage } from '@/components/ChatThread/ChatThread';
import { LabelSheet } from '@/components/LabelSheet/LabelSheet';
import { apiGet } from '@/api/client';

import s from '@/pages/ChatPage/ChatPage.module.css';

type Meta = { user?: { name: string; username: string }; labels?: string[] };
type ListItem = {
  telegram_id: number;
  name: string;
  username: string;
  last_message: string;
  last_sender: 'user' | 'admin' | null;
  last_failed?: boolean;
  updated_at: string;
  unread: number;
  labels: string[];
};
type InfiniteChats = { pages: { items: ListItem[] }[] };

function TagIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 12.6 L11.4 5.2 A2 2 0 0 1 12.8 4.6 L19 4.4 A1 1 0 0 1 20 5.4 L19.8 11.6 A2 2 0 0 1 19.2 13 L11.8 20.4 A1.4 1.4 0 0 1 9.8 20.4 L4 14.6 A1.4 1.4 0 0 1 4 12.6 Z"
        stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <circle cx="16" cy="8.4" r="1.2" fill="currentColor" />
    </svg>
  );
}

export const AdminChatThreadPage: FC = () => {
  const { telegramId } = useParams<{ telegramId: string }>();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [metaLoaded, setMetaLoaded] = useState(false);
  const [labels, setLabels] = useState<string[]>([]);
  const [presets, setPresets] = useState<string[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    apiGet<{ labels: string[] }>('/admin/labels')
      .then(d => setPresets(d.labels))
      .catch(() => { /* presets optional */ });
  }, []);

  // reflect a label change back onto the chat-list cache so the inbox shows the
  // up-to-date labels without waiting for its next poll (across all paged variants)
  function patchListLabels(next: string[]) {
    const id = Number(telegramId);
    queryClient.setQueriesData<InfiniteChats>({ queryKey: ['admin-chats'] }, (old) =>
      old?.pages
        ? {
            ...old,
            pages: old.pages.map(p => ({
              ...p,
              items: p.items.map(it => (it.telegram_id === id ? { ...it, labels: next } : it)),
            })),
          }
        : old);
  }

  // after the admin sends, update the inbox preview + move the chat to the top,
  // so going back shows the new last message immediately (no wait for refetch)
  function patchListPreview(msg: ChatMessage) {
    const id = Number(telegramId);
    queryClient.setQueriesData<InfiniteChats>({ queryKey: ['admin-chats'] }, (old) => {
      if (!old?.pages?.length) return old;
      let found: ListItem | undefined;
      const pages = old.pages.map(p => ({
        ...p,
        items: p.items.filter(it => {
          if (it.telegram_id === id) { found = it; return false; }
          return true;
        }),
      }));
      const updated: ListItem = {
        ...(found ?? { telegram_id: id, name, username, labels, unread: 0 }),
        last_message: msg.text,
        last_sender: 'admin',
        last_failed: false,
        updated_at: msg.created_at,
      };
      pages[0] = { ...pages[0], items: [updated, ...pages[0].items] };
      return { ...old, pages };
    });
  }

  return (
    <Page back>
      <div className={s.root}>
        <header className={`${s.header} ${s.headerAdmin}`}>
          {metaLoaded ? (
            <>
              <span className={s.name}>{name}</span>
              <span className={s.status}>
                {username ? <span className={s.handle}>@{username}</span> : 'Foydalanuvchi'}
              </span>
            </>
          ) : (
            <>
              <span className={s.skelName} aria-hidden />
              <span className={s.skelStatus} aria-hidden />
            </>
          )}
          {metaLoaded ? (
            <button
              type="button"
              className={s.tagBtn}
              onClick={() => setOpen(true)}
              aria-label="Belgilar"
            >
              <TagIcon />
              {labels.length > 0 && <span className={s.tagCount}>{labels.length}</span>}
            </button>
          ) : (
            <span className={s.skelTag} aria-hidden />
          )}
        </header>

        <ChatThread
          basePath={`/admin/chats/${telegramId}`}
          mySide="admin"
          emptyHint="Hozircha xabarlar yo‘q."
          onSent={patchListPreview}
          onMeta={(raw) => {
            const m = raw as Meta;
            if (m.user) { setName(m.user.name); setUsername(m.user.username); setMetaLoaded(true); }
            if (!open && Array.isArray(m.labels)) setLabels(m.labels);
          }}
        />

        {open && (
          <LabelSheet
            telegramId={telegramId!}
            initial={labels}
            allLabels={presets}
            onClose={() => setOpen(false)}
            onSaved={(next) => { setLabels(next); patchListLabels(next); }}
          />
        )}
      </div>
    </Page>
  );
};
