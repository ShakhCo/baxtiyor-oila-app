import { useEffect, useState, type FC } from 'react';
import { useNavigate } from 'react-router-dom';

import { Page } from '@/components/Page.tsx';
import { apiGet } from '@/api/client';

import s from './AnketaListPage.module.css';

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

const UZ_MONTHS = ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyun', 'Iyul', 'Avg', 'Sen', 'Okt', 'Noy', 'Dek'];

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const base = `${UZ_MONTHS[d.getMonth()]} ${d.getDate()}`;
  return d.getFullYear() === new Date().getFullYear() ? base : `${base}, ${d.getFullYear()}`;
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
          <div className={s.notAuth}>
            <h1 className={s.notAuthTitle}>Kirish yo‘q</h1>
            <p className={s.notAuthText}>
              Bu bo‘lim faqat adminlar uchun. Telegram hisobingiz admin guruhiga kiritilmagan.
            </p>
          </div>
        </div>
      </Page>
    );
  }

  return (
    <Page>
      <div className={s.root}>
        <div className={s.fadeTop} aria-hidden />
        <div className={s.fadeBottom} aria-hidden />

        <header className={s.header}>
          <div>
            <p className={s.eyebrow}>Admin panel</p>
            <h1 className={s.title}>Anketalar</h1>
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
              className={filter === key ? `${s.tab} ${s.tabActive}` : s.tab}
              onClick={() => setFilter(key)}
            >
              {STATUS_LABELS[key]}
              <span className={s.tabCount}>{counts[key]}</span>
            </button>
          ))}
        </div>

        {error && <div className={s.error}>{error}</div>}

        {loading ? (
          <div className={s.list}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div className={s.skel} key={i} aria-hidden>
                <span className={s.skelMain}>
                  <span className={s.skelLineWide} />
                  <span className={s.skelLine} />
                  <span className={s.skelLine} style={{ width: '42%' }} />
                </span>
                <span className={s.skelBadge} />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <p className={s.empty}>Anketalar yo‘q</p>
        ) : (
          <div className={s.list}>
            {items.map(item => (
              <button
                key={item.telegram_id}
                type="button"
                className={s.card}
                onClick={() => navigate(`/admin/anketa/${item.telegram_id}`)}
              >
                <span className={s.cardMain}>
                  <span className={s.cardName}>{item.full_name}</span>
                  <span className={s.cardLine}>
                    {item.age} yosh · {REGION_LABELS[item.birthplace_region] ?? item.birthplace_region}
                  </span>
                  <span className={s.cardLine}>{item.current_residence_germany}</span>
                  <span className={s.cardDate}>{formatDate(item.created_at)}</span>
                </span>
                <span className={s.cardRight}>
                  <span className={`${s.badge} ${
                    item.status === 'pending'  ? s.badgePending :
                    item.status === 'approved' ? s.badgeApproved :
                                                 s.badgeRejected
                  }`}>
                    {STATUS_LABELS[item.status]}
                  </span>
                  <span className={s.tariff}>{item.tariff}</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </Page>
  );
};
