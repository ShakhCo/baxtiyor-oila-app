import { useEffect, useState, type FC, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { Page } from '@/components/Page.tsx';
import { apiGet, apiPost } from '@/api/client';

import s from './AnketaDetailPage.module.css';

type Status = 'pending' | 'approved' | 'rejected';

type AnketaDetail = {
  telegram_id:               number;
  first_name:                string;
  last_name:                 string;
  username:                  string;
  language_code:             string;
  full_name:                 string;
  age:                       number;
  birthplace_region:         string;
  current_residence_germany: string;
  height_weight:             string;
  education:                 string;
  profession_hobbies:        string;
  marital_status:            string;
  family_info:               string;
  nationality_languages:     string;
  religion:                  string;
  germany_status:            string;
  self_description:          string;
  partner_expectations:      string;
  contact_info:              string;
  tariff:                    'basic' | 'standart';
  status:                    Status;
  rejection_reason:          string;
  created_at:                string;
  updated_at:                string;
};

const REGION_LABELS: Record<string, string> = {
  andijon:          'Andijon',
  buxoro:           'Buxoro',
  fargona:          'Farg‘ona',
  jizzax:           'Jizzax',
  namangan:         'Namangan',
  navoiy:           'Navoiy',
  qashqadaryo:      'Qashqadaryo',
  qoraqalpogiston:  'Qoraqalpog‘iston Respublikasi',
  samarqand:        'Samarqand',
  sirdaryo:         'Sirdaryo',
  surxandaryo:      'Surxandaryo',
  toshkent_shahar:  'Toshkent shahar',
  toshkent_viloyat: 'Toshkent viloyat',
  xorazm:           'Xorazm',
};

function Row({ label, children }: { label: string; children: ReactNode }) {
  if (children == null || children === '') return null;
  return (
    <div className={s.row}>
      <div className={s.rowLabel}>{label}</div>
      <div className={s.rowValue}>{children}</div>
    </div>
  );
}

export const AdminAnketaDetailPage: FC = () => {
  const { telegramId } = useParams<{ telegramId: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<AnketaDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (!telegramId) return;
    setLoading(true);
    apiGet<AnketaDetail>(`/admin/anketas/${telegramId}`)
      .then(setData)
      .catch(err => setError(`Yuklashda xatolik: ${err.message}`))
      .finally(() => setLoading(false));
  }, [telegramId]);

  async function approve() {
    if (!telegramId || busy) return;
    setBusy(true);
    setError(null);
    try {
      await apiPost(`/admin/anketas/${telegramId}/approve`, {});
      navigate('/admin');
    } catch (err) {
      setError(`Tasdiqlashda xatolik: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  async function reject() {
    if (!telegramId || busy || !reason.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await apiPost(`/admin/anketas/${telegramId}/reject`, { reason });
      setRejectOpen(false);
      navigate('/admin');
    } catch (err) {
      setError(`Rad etishda xatolik: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <Page><div className={s.root}><div className={s.loading}>Yuklanmoqda…</div></div></Page>;
  }
  if (!data) {
    return <Page><div className={s.root}><div className={s.empty}>Anketa topilmadi</div></div></Page>;
  }

  const tgHandle = data.username ? `@${data.username}` : null;
  const region = REGION_LABELS[data.birthplace_region] ?? data.birthplace_region;
  const isPending = data.status === 'pending';

  return (
    <Page>
      <div className={isPending ? s.root : `${s.root} ${s.rootFlat}`}>
        <div className={s.fadeTop} aria-hidden />
        <div className={s.fadeBottom} aria-hidden />

        <header className={s.detailHeader}>
          <p className={s.eyebrow}>Anketa</p>
          <h1 className={s.name}>{data.full_name}</h1>
          <div className={s.meta}>
            {data.age} yosh
            {tgHandle && <> · <a className={s.handle} href={`https://t.me/${data.username}`} target="_blank" rel="noreferrer">{tgHandle}</a></>}
            <> · <span className={s.tariffText}>{data.tariff}</span></>
          </div>
          <div className={s.statusRow}>
            <span className={`${s.badge} ${
              data.status === 'pending'  ? s.badgePending :
              data.status === 'approved' ? s.badgeApproved :
                                            s.badgeRejected
            }`}>
              {data.status === 'pending' ? 'Yangi' : data.status === 'approved' ? 'Tasdiqlangan' : 'Rad etilgan'}
            </span>
          </div>
        </header>

        {error && <div className={s.error}>{error}</div>}

        {data.status === 'rejected' && data.rejection_reason && (
          <div className={s.section}>
            <div className={`${s.sectionLabel} ${s.sectionLabelWarn}`}>Rad etish sababi</div>
            <div className={s.rowValue}>{data.rejection_reason}</div>
          </div>
        )}

        <div className={s.section}>
          <div className={s.sectionLabel}>I. O‘zi haqida</div>
          <Row label="Tug‘ilgan joy">{region}</Row>
          <Row label="Hozirgi joy (DE)">{data.current_residence_germany}</Row>
          <Row label="Bo‘yi, vazni">{data.height_weight}</Row>
        </div>

        <div className={s.section}>
          <div className={s.sectionLabel}>II. Ma‘lumot va kasb</div>
          <Row label="Ma‘lumoti">{data.education}</Row>
          <Row label="Kasbi va xobbi">{data.profession_hobbies}</Row>
        </div>

        <div className={s.section}>
          <div className={s.sectionLabel}>III. Oila</div>
          <Row label="Oilaviy holati">{data.marital_status}</Row>
          <Row label="Oilada">{data.family_info}</Row>
          <Row label="Millat / tillar">{data.nationality_languages}</Row>
          <Row label="Din">{data.religion}</Row>
        </div>

        <div className={s.section}>
          <div className={s.sectionLabel}>IV. Germaniya</div>
          <Row label="Status va rejalar">{data.germany_status}</Row>
        </div>

        <div className={s.section}>
          <div className={s.sectionLabel}>V. Shaxsiyat</div>
          <Row label="O‘zi haqida">{data.self_description}</Row>
          <Row label="Idealdagi juftlik">{data.partner_expectations}</Row>
        </div>

        <div className={s.section}>
          <div className={s.sectionLabel}>VI. Aloqa</div>
          <Row label="Murojaat uchun">{data.contact_info}</Row>
          <Row label="Telegram ID">{String(data.telegram_id)}</Row>
          <Row label="Yuborilgan">{new Date(data.created_at).toLocaleString()}</Row>
        </div>

        {isPending && (
          <div className={s.actions}>
            <button
              type="button"
              className={`${s.btn} ${s.btnReject}`}
              disabled={busy}
              onClick={() => setRejectOpen(true)}
            >
              Rad etish
            </button>
            <button
              type="button"
              className={`${s.btn} ${s.btnApprove}`}
              disabled={busy}
              onClick={approve}
            >
              Tasdiqlash
            </button>
          </div>
        )}

        {rejectOpen && (
          <div className={s.modalScrim} onClick={() => !busy && setRejectOpen(false)}>
            <div className={s.modal} onClick={e => e.stopPropagation()}>
              <h3 className={s.modalTitle}>Rad etish sababi</h3>
              <p className={s.modalText}>
                Foydalanuvchiga ko‘rsatiladi. Iltimos, qisqa va aniq bo‘ling.
              </p>
              <textarea
                className={s.modalTextarea}
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="Masalan: Ma‘lumotlar to‘liq emas…"
                autoFocus
              />
              <div className={s.modalActions}>
                <button
                  type="button"
                  className={`${s.btn} ${s.btnGhost}`}
                  onClick={() => setRejectOpen(false)}
                  disabled={busy}
                >
                  Bekor qilish
                </button>
                <button
                  type="button"
                  className={`${s.btn} ${s.btnReject}`}
                  onClick={reject}
                  disabled={busy || !reason.trim()}
                >
                  Rad etish
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Page>
  );
};
