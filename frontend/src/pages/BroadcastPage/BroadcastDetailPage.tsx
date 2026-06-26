import { type FC } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { Page } from '@/components/Page.tsx';
import { apiGet } from '@/api/client';

import s from './BroadcastPage.module.css';

type Recipient = {
  telegram_id: number;
  name: string;
  username: string;
  status: 'sent' | 'failed';
};
type Detail = {
  id: number;
  text: string;
  images: string[];
  status: 'pending' | 'running' | 'done';
  total: number;
  sent: number;
  failed: number;
  created_at: string;
  finished_at: string | null;
  recipients: Recipient[];
};

function RecipientRow({ r }: { r: Recipient }) {
  return (
    <div className={s.recipient}>
      <span className={`${s.dot} ${r.status === 'sent' ? s.dotOk : s.dotFail}`} aria-hidden />
      <span className={s.recipientName}>{r.name}</span>
      {r.username && <span className={s.recipientUser}>@{r.username}</span>}
    </div>
  );
}

export const BroadcastDetailPage: FC = () => {
  const { id } = useParams<{ id: string }>();

  const { data } = useQuery({
    queryKey: ['broadcast', id],
    queryFn: () => apiGet<Detail>(`/admin/broadcasts/${id}`),
    // keep refreshing the report while delivery is still in progress
    refetchInterval: (query) =>
      query.state.data && query.state.data.status !== 'done' ? 1500 : false,
  });

  const sentList = data?.recipients.filter(r => r.status === 'sent') ?? [];
  const failedList = data?.recipients.filter(r => r.status === 'failed') ?? [];

  return (
    <Page back>
      <div className={s.root}>
        <header className={s.header}>
          <p className={s.eyebrow}>
            {!data ? 'Hisobot' : data.status === 'done' ? 'Yakunlandi' : 'Yuborilmoqda'}
          </p>
          <h1 className={s.title}>Hisobot</h1>
        </header>

        {!data ? (
          <>
            <div className={s.detailSkel} />
            <div className={s.detailSkel} />
            <div className={s.detailSkel} />
          </>
        ) : (
          <>
            <div className={s.card} style={{ cursor: 'default' }}>
              {data.images.length > 0 && (
                <div className={s.photos}>
                  {data.images.map(url => (
                    <div className={s.thumb} key={url}>
                      <img className={s.thumbImg} src={url} alt="" loading="lazy" />
                    </div>
                  ))}
                </div>
              )}
              {data.text && <p className={`${s.cardText} ${s.fullText}`}>{data.text}</p>}
              <div className={s.stats}>
                <span className={s.statOk}>✓ {data.sent.toLocaleString('uz-UZ')} yuborildi</span>
                <span className={s.statFail}>✕ {data.failed.toLocaleString('uz-UZ')}</span>
                <span className={s.statTotal}>/ {data.total.toLocaleString('uz-UZ')}</span>
              </div>
            </div>

            {sentList.length > 0 && (
              <div className={s.group}>
                <p className={s.groupTitle}>Yetkazildi · {sentList.length.toLocaleString('uz-UZ')}</p>
                {sentList.map(r => <RecipientRow key={r.telegram_id} r={r} />)}
              </div>
            )}

            {failedList.length > 0 && (
              <div className={s.group}>
                <p className={s.groupTitle}>Yetkazilmadi · {failedList.length.toLocaleString('uz-UZ')}</p>
                {failedList.map(r => <RecipientRow key={r.telegram_id} r={r} />)}
              </div>
            )}
          </>
        )}
      </div>
    </Page>
  );
};
