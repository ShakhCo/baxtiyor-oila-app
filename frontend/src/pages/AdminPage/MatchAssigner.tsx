import { useEffect, useState, type FC } from 'react';
import { useNavigate } from 'react-router-dom';

import { apiDelete, apiGet } from '@/api/client';

import s from './MatchAssigner.module.css';

type Summary = {
  telegram_id: number;
  full_name: string;
  age: number;
  birthplace_region: string;
  status: string;
  tariff: string;
};

const REGION_LABELS: Record<string, string> = {
  andijon: 'Andijon', buxoro: 'Buxoro', fargona: 'Farg‘ona', jizzax: 'Jizzax',
  namangan: 'Namangan', navoiy: 'Navoiy', qashqadaryo: 'Qashqadaryo',
  qoraqalpogiston: 'Qoraqalpog‘iston', samarqand: 'Samarqand', sirdaryo: 'Sirdaryo',
  surxandaryo: 'Surxandaryo', toshkent_shahar: 'Toshkent shahar',
  toshkent_viloyat: 'Toshkent viloyat', xorazm: 'Xorazm',
};
const region = (r: string) => REGION_LABELS[r] ?? r;

export const MatchAssigner: FC<{ telegramId: string }> = ({ telegramId }) => {
  const navigate = useNavigate();
  const [assigned, setAssigned] = useState<Summary[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    apiGet<{ matches: Summary[] }>(`/admin/anketas/${telegramId}/matches`)
      .then(d => setAssigned(d.matches))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [telegramId]);

  function remove(id: number) {
    setAssigned(prev => prev.filter(x => x.telegram_id !== id)); // optimistic
    apiDelete(`/admin/anketas/${telegramId}/matches/${id}`).catch(() => {});
  }

  return (
    <div className={s.section}>
      <div className={s.head}>
        <span className={s.label}>Mos anketalar ({assigned.length})</span>
        <button
          type="button"
          className={s.addBtn}
          onClick={() => navigate(`/admin/anketa/${telegramId}/assign`)}
        >
          + Qo‘shish
        </button>
      </div>

      {!loaded ? (
        <p className={s.hint}>Yuklanmoqda…</p>
      ) : assigned.length === 0 ? (
        <p className={s.hint}>Hali anketa tayinlanmagan. Foydalanuvchi faqat tayinlanganlarni ko‘radi.</p>
      ) : (
        <div className={s.list}>
          {assigned.map(c => (
            <div className={s.row} key={c.telegram_id}>
              <div className={s.rowMain}>
                <span className={s.rowName}>{c.full_name}</span>
                <span className={s.rowMeta}>{c.age} yosh · {region(c.birthplace_region)}</span>
              </div>
              <button type="button" className={s.remove} onClick={() => remove(c.telegram_id)} aria-label="O‘chirish">×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
