import { useEffect, useMemo, useState, type FC } from 'react';

import { apiDelete, apiGet, apiPost } from '@/api/client';

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

const STATUS_LABEL: Record<string, string> = {
  pending: 'Yangi', approved: 'Tasdiqlangan', rejected: 'Rad etilgan',
};

export const MatchAssigner: FC<{ telegramId: string }> = ({ telegramId }) => {
  const [assigned, setAssigned] = useState<Summary[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(false);
  const [pool, setPool] = useState<Summary[] | null>(null);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    apiGet<{ matches: Summary[] }>(`/admin/anketas/${telegramId}/matches`)
      .then(d => setAssigned(d.matches))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [telegramId]);

  function openPicker() {
    setOpen(true);
    setQuery('');
    if (pool === null) {
      apiGet<{ items: Summary[] }>('/admin/anketas?status=all')
        .then(d => setPool(d.items))
        .catch(() => setPool([]));
    }
  }

  function add(id: number) {
    setBusy(true);
    apiPost<{ matches: Summary[] }>(`/admin/anketas/${telegramId}/matches`, { candidate_id: id })
      .then(d => { setAssigned(d.matches); setOpen(false); })
      .catch(() => {})
      .finally(() => setBusy(false));
  }

  function remove(id: number) {
    setAssigned(prev => prev.filter(x => x.telegram_id !== id)); // optimistic
    apiDelete(`/admin/anketas/${telegramId}/matches/${id}`).catch(() => {});
  }

  const selfId = Number(telegramId);
  const assignedIds = useMemo(() => new Set(assigned.map(a => a.telegram_id)), [assigned]);
  const choices = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (pool ?? [])
      .filter(p => p.telegram_id !== selfId && !assignedIds.has(p.telegram_id))
      .filter(p => !q || p.full_name.toLowerCase().includes(q));
  }, [pool, query, selfId, assignedIds]);

  return (
    <div className={s.section}>
      <div className={s.head}>
        <span className={s.label}>Mos anketalar ({assigned.length})</span>
        <button type="button" className={s.addBtn} onClick={openPicker}>+ Qo‘shish</button>
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

      {open && (
        <div className={s.backdrop} onClick={() => setOpen(false)}>
          <div className={s.sheet} onClick={e => e.stopPropagation()}>
            <h3 className={s.sheetTitle}>Anketa qo‘shish</h3>
            <input
              className={s.search}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Ism bo‘yicha qidirish…"
              autoFocus
            />
            <div className={s.options}>
              {pool === null ? (
                <p className={s.hint}>Yuklanmoqda…</p>
              ) : choices.length === 0 ? (
                <p className={s.hint}>Anketa topilmadi</p>
              ) : (
                choices.map(c => (
                  <button
                    key={c.telegram_id}
                    type="button"
                    className={s.option}
                    disabled={busy}
                    onClick={() => add(c.telegram_id)}
                  >
                    <span className={s.optMain}>
                      <span className={s.rowName}>{c.full_name}</span>
                      <span className={s.rowMeta}>{c.age} yosh · {region(c.birthplace_region)}</span>
                    </span>
                    <span className={`${s.tag} ${s[`tag_${c.status}`]}`}>{STATUS_LABEL[c.status] ?? c.status}</span>
                  </button>
                ))
              )}
            </div>
            <button type="button" className={s.close} onClick={() => setOpen(false)}>Yopish</button>
          </div>
        </div>
      )}
    </div>
  );
};
