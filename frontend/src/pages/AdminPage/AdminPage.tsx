import { useEffect, useState, type FC } from 'react';
import { useNavigate } from 'react-router-dom';

import { Page } from '@/components/Page.tsx';
import { apiGet } from '@/api/client';

import s from './AdminPage.module.css';

type FilterKey = 'pending' | 'approved' | 'rejected';

type AnketaSummary = {
  telegram_id:               number;
  full_name:                 string;
  age:                       number;
  birthplace_region:         string;
  current_residence_germany: string;
  tariff:                    'basic' | 'standart';
  status:                    FilterKey;
  created_at:                string;
};

type ListResponse = {
  items:  AnketaSummary[];
  counts: Record<FilterKey, number>;
  filter: string;
};

type MeResponse = {
  telegram_id: number;
  is_admin:    boolean;
};

const REGION_LABELS: Record<string, string> = {
  andijon:          'Andijon',
  buxoro:           'Buxoro',
  fargona:          'Farg‘ona',
  jizzax:           'Jizzax',
  namangan:         'Namangan',
  navoiy:           'Navoiy',
  qashqadaryo:      'Qashqadaryo',
  qoraqalpogiston:  'Qoraqalpog‘iston',
  samarqand:        'Samarqand',
  sirdaryo:         'Sirdaryo',
  surxandaryo:      'Surxandaryo',
  toshkent_shahar:  'Toshkent shahar',
  toshkent_viloyat: 'Toshkent viloyat',
  xorazm:           'Xorazm',
};

const STATUS_LABELS: Record<FilterKey, string> = {
  pending:  'Yangi',
  approved: 'Tasdiqlangan',
  rejected: 'Rad etilgan',
};

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  } catch { return iso; }
}

export const AdminPage: FC = () => {
  const navigate = useNavigate();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [items, setItems] = useState<AnketaSummary[]>([]);
  const [counts, setCounts] = useState<Record<FilterKey, number>>({ pending: 0, approved: 0, rejected: 0 });
  const [filter, setFilter] = useState<FilterKey>('pending');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiGet<MeResponse>('/me')
      .then(setMe)
      .catch(err => setError(`Auth error: ${err.message}`));
  }, []);

  useEffect(() => {
    if (!me?.is_admin) return;
    setLoading(true);
    apiGet<ListResponse>(`/admin/anketas?status=${filter}`)
      .then(data => {
        setItems(data.items);
        setCounts(data.counts);
      })
      .catch(err => setError(`Yuklashda xatolik: ${err.message}`))
      .finally(() => setLoading(false));
  }, [filter, me?.is_admin]);

  if (!me) {
    return <Page><div className={s.root}><div className={s.loading}>Tekshirilmoqda…</div></div></Page>;
  }

  if (!me.is_admin) {
    return (
      <Page>
        <div className={s.root}>
          <div className={s.notAuthorized}>
            <h1 className={s.notAuthorizedTitle}>Kirish yo‘q</h1>
            <p className={s.notAuthorizedText}>
              Bu bo‘lim faqat adminlar uchun. Sizning Telegram hisobingiz admin guruhiga kiritilmagan.
            </p>
          </div>
        </div>
      </Page>
    );
  }

  return (
    <Page>
      <div className={s.root}>
        <div className={s.content}>
          <header className={s.pageHeader}>
            <div>
              <div className={s.eyebrow}>Admin</div>
              <h1 className={s.pageTitle}>Anketalar</h1>
            </div>
            <button type="button" className={s.chatLink} onClick={() => navigate('/admin/chat')}>
              Suhbatlar
            </button>
          </header>

          <div className={s.tabs}>
            {(['pending', 'approved', 'rejected'] as FilterKey[]).map(key => (
              <button
                key={key}
                type="button"
                className={s.tab}
                data-active={filter === key}
                onClick={() => setFilter(key)}
              >
                <span>{STATUS_LABELS[key]}</span>
                <span className={s.tabCount}>{counts[key]}</span>
              </button>
            ))}
          </div>

          {error && <div className={s.errorBanner}>{error}</div>}

          {loading ? (
            <div className={s.loading}>Yuklanmoqda…</div>
          ) : items.length === 0 ? (
            <div className={s.empty}>Anketalar yo‘q</div>
          ) : (
            <div className={s.list}>
              {items.map(item => (
                <button
                  key={item.telegram_id}
                  type="button"
                  className={s.cardLink}
                  onClick={() => navigate(`/admin/anketa/${item.telegram_id}`)}
                >
                  <div>
                    <div className={s.cardName}>{item.full_name}</div>
                    <div className={s.cardLine}>
                      {item.age} yosh · {REGION_LABELS[item.birthplace_region] ?? item.birthplace_region}
                    </div>
                    <div className={s.cardLine}>{item.current_residence_germany}</div>
                    <div className={s.cardMeta}>{formatDate(item.created_at)}</div>
                  </div>
                  <div className={s.cardRight}>
                    <span className={[
                      s.statusBadge,
                      item.status === 'pending'  ? s.badgePending :
                      item.status === 'approved' ? s.badgeApproved :
                                                   s.badgeRejected,
                    ].join(' ')}>{STATUS_LABELS[item.status]}</span>
                    <span className={s.tariffBadge}>{item.tariff}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </Page>
  );
};
