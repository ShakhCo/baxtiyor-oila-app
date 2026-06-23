import { useEffect, useMemo, useState, type FC } from 'react';
import { useParams } from 'react-router-dom';

import { Page } from '@/components/Page.tsx';
import { apiDelete, apiGet, apiPost } from '@/api/client';

import s from './AssignMatchesPage.module.css';

type Suggestion = {
  telegram_id: number;
  full_name: string;
  age: number;
  birthplace_region: string;
  gender: 'male' | 'female' | '';
  status: string;
  match_percent: number;
  assigned: boolean;
};

const REGION_LABELS: Record<string, string> = {
  andijon: 'Andijon', buxoro: 'Buxoro', fargona: 'Farg‘ona', jizzax: 'Jizzax',
  namangan: 'Namangan', navoiy: 'Navoiy', qashqadaryo: 'Qashqadaryo',
  qoraqalpogiston: 'Qoraqalpog‘iston', samarqand: 'Samarqand', sirdaryo: 'Sirdaryo',
  surxandaryo: 'Surxandaryo', toshkent_shahar: 'Toshkent shahar',
  toshkent_viloyat: 'Toshkent viloyat', xorazm: 'Xorazm',
};
const region = (r: string) => REGION_LABELS[r] ?? r;
const GENDER_LABEL: Record<string, string> = { male: 'Erkak', female: 'Ayol' };
const STATUS_LABEL: Record<string, string> = { pending: 'Yangi', approved: 'Tasdiqlangan', rejected: 'Rad etilgan' };

export const AssignMatchesPage: FC = () => {
  const { telegramId } = useParams<{ telegramId: string }>();
  const [items, setItems] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);

  useEffect(() => {
    apiGet<{ suggestions: Suggestion[] }>(`/admin/anketas/${telegramId}/suggestions`)
      .then(d => setItems(d.suggestions))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [telegramId]);

  function toggle(c: Suggestion) {
    setBusyId(c.telegram_id);
    const op = c.assigned
      ? apiDelete(`/admin/anketas/${telegramId}/matches/${c.telegram_id}`)
      : apiPost(`/admin/anketas/${telegramId}/matches`, { candidate_id: c.telegram_id });
    op.then(() => setItems(prev =>
        prev.map(x => x.telegram_id === c.telegram_id ? { ...x, assigned: !x.assigned } : x)))
      .catch(() => {})
      .finally(() => setBusyId(null));
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? items.filter(i => i.full_name.toLowerCase().includes(q)) : items;
  }, [items, query]);

  return (
    <Page back>
      <div className={s.root}>
        <div className={s.fadeTop} aria-hidden />
        <header className={s.header}>
          <h1 className={s.title}>Anketa qo‘shish</h1>
          <p className={s.sub}>Moslik foizi bo‘yicha tartiblangan</p>
        </header>

        <input
          className={s.search}
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Ism bo‘yicha qidirish…"
        />

        {loading ? (
          <p className={s.note}>Yuklanmoqda…</p>
        ) : filtered.length === 0 ? (
          <p className={s.note}>Anketa topilmadi</p>
        ) : (
          <div className={s.list}>
            {filtered.map(c => (
              <div className={c.assigned ? `${s.card} ${s.cardOn}` : s.card} key={c.telegram_id}>
                <div className={s.top}>
                  <div className={s.main}>
                    <span className={s.name}>{c.full_name}</span>
                    <span className={s.meta}>
                      {c.age} yosh · {region(c.birthplace_region)}
                      {c.gender ? ` · ${GENDER_LABEL[c.gender]}` : ''}
                    </span>
                    <span className={`${s.tag} ${s[`tag_${c.status}`]}`}>
                      {STATUS_LABEL[c.status] ?? c.status}
                    </span>
                  </div>
                  <span className={s.score}>{c.match_percent}%</span>
                </div>
                <button
                  type="button"
                  className={c.assigned ? `${s.toggle} ${s.toggleOff}` : `${s.toggle} ${s.toggleOn}`}
                  disabled={busyId === c.telegram_id}
                  onClick={() => toggle(c)}
                >
                  {c.assigned ? 'Olib tashlash' : 'Qo‘shish'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </Page>
  );
};
