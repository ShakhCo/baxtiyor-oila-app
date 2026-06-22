import { useState, type FC } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { Page } from '@/components/Page.tsx';
import { apiGet, apiPost } from '@/api/client';

import s from './BroadcastPage.module.css';
import sheet from '@/pages/ChatPage/ChatPage.module.css';

type Broadcast = {
  id: number;
  text: string;
  status: 'pending' | 'running' | 'done';
  total: number;
  sent: number;
  failed: number;
  created_at: string;
  finished_at: string | null;
};
type Payload = { items: Broadcast[]; user_count: number };

const KEY = ['broadcasts'] as const;
const UZ_MONTHS = ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyun', 'Iyul', 'Avg', 'Sen', 'Okt', 'Noy', 'Dek'];

function timeLabel(iso: string): string {
  const d = new Date(iso);
  const t = new Date();
  const hm = d.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === t.toDateString()) return hm;
  return `${UZ_MONTHS[d.getMonth()]} ${d.getDate()}, ${hm}`;
}

function statusLabel(b: Broadcast): string {
  if (b.status === 'done') return 'Yakunlandi';
  if (b.status === 'running') return 'Yuborilmoqda';
  return 'Navbatda';
}

export const BroadcastPage: FC = () => {
  const queryClient = useQueryClient();
  const [text, setText] = useState('');
  const [confirm, setConfirm] = useState(false);

  const { data } = useQuery({
    queryKey: KEY,
    queryFn: () => apiGet<Payload>('/admin/broadcasts'),
    // poll while anything is still in flight, otherwise rest
    refetchInterval: (query) =>
      query.state.data?.items.some(i => i.status !== 'done') ? 1500 : false,
  });
  const items = data?.items ?? [];
  const userCount = data?.user_count ?? 0;

  const send = useMutation({
    mutationFn: (body: string) => apiPost<Broadcast>('/admin/broadcasts', { text: body }),
    onSuccess: (bc) => {
      setText('');
      setConfirm(false);
      queryClient.setQueryData<Payload>(KEY, (prev) =>
        prev ? { ...prev, items: [bc, ...prev.items] } : { items: [bc], user_count: userCount });
      queryClient.invalidateQueries({ queryKey: KEY });
    },
  });

  const canSend = text.trim().length > 0 && !send.isPending;

  return (
    <Page back>
      <div className={s.root}>
        <header className={s.header}>
          <p className={s.eyebrow}>{userCount.toLocaleString('uz-UZ')} foydalanuvchi</p>
          <h1 className={s.title}>Ommaviy xabar</h1>
        </header>

        <textarea
          className={s.textarea}
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Hammaga yuboriladigan xabar…"
          rows={5}
        />
        <button type="button" className={s.send} disabled={!canSend} onClick={() => setConfirm(true)}>
          Yuborish
        </button>

        {items.length > 0 && (
          <div className={s.history}>
            <p className={s.historyTitle}>Yuborilganlar</p>
            {items.map(b => {
              const done = b.sent + b.failed;
              const pct = b.total ? Math.round((done / b.total) * 100) : 0;
              return (
                <div key={b.id} className={s.card}>
                  <div className={s.cardTop}>
                    <span className={`${s.badge} ${b.status === 'done' ? s.badgeDone : s.badgeRun}`}>
                      {statusLabel(b)}
                    </span>
                    <span className={s.cardTime}>{timeLabel(b.created_at)}</span>
                  </div>
                  <p className={s.cardText}>{b.text}</p>
                  <div className={s.stats}>
                    <span className={s.statOk}>✓ {b.sent.toLocaleString('uz-UZ')} yuborildi</span>
                    <span className={s.statFail}>✕ {b.failed.toLocaleString('uz-UZ')}</span>
                    <span className={s.statTotal}>/ {b.total.toLocaleString('uz-UZ')}</span>
                  </div>
                  {b.status !== 'done' && (
                    <div className={s.progress}>
                      <div className={s.progressBar} style={{ width: `${pct}%` }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {confirm && (
          <div className={sheet.sheetBackdrop} onClick={() => setConfirm(false)}>
            <div className={sheet.sheet} onClick={e => e.stopPropagation()}>
              <h2 className={sheet.sheetTitle}>Tasdiqlang</h2>
              <p className={sheet.sheetHint}>
                Ushbu xabar {userCount.toLocaleString('uz-UZ')} foydalanuvchiga yuboriladi. Davom etilsinmi?
              </p>
              <button
                type="button"
                className={s.confirmSend}
                disabled={send.isPending}
                onClick={() => send.mutate(text.trim())}
              >
                {send.isPending ? 'Yuborilmoqda…' : 'Ha, yuborish'}
              </button>
              <button type="button" className={sheet.sheetClose} onClick={() => setConfirm(false)}>
                Bekor qilish
              </button>
            </div>
          </div>
        )}
      </div>
    </Page>
  );
};
