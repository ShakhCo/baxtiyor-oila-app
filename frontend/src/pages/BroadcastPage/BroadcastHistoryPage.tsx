import { type FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { Page } from '@/components/Page.tsx';
import { apiGet } from '@/api/client';

import s from './BroadcastPage.module.css';

type Broadcast = {
  id: number;
  text: string;
  image_count: number;
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

export const BroadcastHistoryPage: FC = () => {
  const navigate = useNavigate();

  const { data } = useQuery({
    queryKey: KEY,
    queryFn: () => apiGet<Payload>('/admin/broadcasts'),
    // poll while anything is still in flight, otherwise rest
    refetchInterval: (query) =>
      query.state.data?.items.some(i => i.status !== 'done') ? 1500 : false,
  });
  const items = data?.items ?? [];

  return (
    <Page back>
      <div className={s.root}>
        <header className={s.header}>
          <p className={s.eyebrow}>Tarix</p>
          <h1 className={s.title}>Yuborilganlar</h1>
        </header>

        {items.length === 0 ? (
          <p className={s.empty}>Hozircha ommaviy xabar yuborilmagan.</p>
        ) : (
          <div className={s.history}>
            {items.map(b => {
              const done = b.sent + b.failed;
              const pct = b.total ? Math.round((done / b.total) * 100) : 0;
              return (
                <button
                  key={b.id}
                  type="button"
                  className={s.card}
                  onClick={() => navigate(`/admin/broadcast/${b.id}`)}
                >
                  <div className={s.cardTop}>
                    <span className={`${s.badge} ${b.status === 'done' ? s.badgeDone : s.badgeRun}`}>
                      {statusLabel(b)}
                    </span>
                    <span className={s.cardTime}>{timeLabel(b.created_at)}</span>
                  </div>
                  <p className={s.cardText}>
                    {b.image_count > 0 && <span className={s.photoTag}>📷 {b.image_count}</span>}
                    {b.text || (b.image_count > 0 ? 'Rasm' : '—')}
                  </p>
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
                </button>
              );
            })}
          </div>
        )}
      </div>
    </Page>
  );
};
