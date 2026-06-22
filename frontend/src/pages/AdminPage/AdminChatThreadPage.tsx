import { useEffect, useState, type FC } from 'react';
import { useParams } from 'react-router-dom';

import { Page } from '@/components/Page.tsx';
import { ChatThread } from '@/components/ChatThread/ChatThread';
import { apiGet, apiPost } from '@/api/client';

import s from '@/pages/ChatPage/ChatPage.module.css';

type Meta = { user?: { name: string; username: string }; labels?: string[] };

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
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [metaLoaded, setMetaLoaded] = useState(false);
  const [labels, setLabels] = useState<string[]>([]);
  const [presets, setPresets] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    apiGet<{ labels: string[] }>('/admin/labels')
      .then(d => setPresets(d.labels))
      .catch(() => { /* presets optional */ });
  }, []);

  function save(next: string[]) {
    const clean = Array.from(new Set(next.map(l => l.trim()).filter(Boolean))).slice(0, 8);
    setLabels(clean);
    apiPost(`/admin/chats/${telegramId}/labels`, { labels: clean }).catch(() => { /* keep local */ });
  }
  function addLabel(value: string) {
    const v = value.trim();
    setDraft('');
    if (v && !labels.includes(v)) save([...labels, v]);
  }
  function removeLabel(value: string) {
    save(labels.filter(l => l !== value));
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
          onMeta={(raw) => {
            const m = raw as Meta;
            if (m.user) { setName(m.user.name); setUsername(m.user.username); setMetaLoaded(true); }
            if (!open && Array.isArray(m.labels)) setLabels(m.labels);
          }}
        />

        {open && (
          <div className={s.sheetBackdrop} onClick={() => setOpen(false)}>
            <div className={s.sheet} onClick={e => e.stopPropagation()}>
              <h2 className={s.sheetTitle}>Belgilar</h2>

              {labels.length > 0 ? (
                <div className={s.chipRow}>
                  {labels.map(l => (
                    <button key={l} type="button" className={s.chip} onClick={() => removeLabel(l)}>
                      {l}<span className={s.chipX}>×</span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className={s.sheetHint}>Bu suhbatga hali belgi qo‘shilmagan.</p>
              )}

              <div className={s.addRow}>
                <input
                  className={s.labelInput}
                  value={draft}
                  onChange={e => setDraft(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') addLabel(draft); }}
                  placeholder="Yangi belgi…"
                  maxLength={40}
                />
                <button
                  type="button"
                  className={s.addBtn}
                  onClick={() => addLabel(draft)}
                  disabled={!draft.trim()}
                >
                  Qo‘shish
                </button>
              </div>

              <div className={s.presets}>
                {presets.filter(p => !labels.includes(p)).map(p => (
                  <button key={p} type="button" className={s.preset} onClick={() => addLabel(p)}>
                    + {p}
                  </button>
                ))}
              </div>

              <button type="button" className={s.sheetClose} onClick={() => setOpen(false)}>
                Yopish
              </button>
            </div>
          </div>
        )}
      </div>
    </Page>
  );
};
