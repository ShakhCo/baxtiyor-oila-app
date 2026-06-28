import { useEffect, useState, type FC, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { Page } from '@/components/Page.tsx';
import { Lightbox } from '@/components/Lightbox/Lightbox';
import { apiGet, apiPost, invalidate, CACHE_TTL } from '@/api/client';

import { MatchAssigner } from './MatchAssigner';
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
  photos:                    { id: number; url: string }[];
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
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (!telegramId) return;
    setLoading(true);
    apiGet<AnketaDetail>(`/admin/anketas/${telegramId}`, { ttl: CACHE_TTL.detail })
      .then(setData)
      .catch(err => setError(`Yuklashda xatolik: ${err.message}`))
      .finally(() => setLoading(false));
  }, [telegramId]);

  // Move the anketa to any status. Rejecting carries the reason from the modal.
  async function applyStatus(next: Status, withReason?: string) {
    if (!telegramId || busy) return;
    setBusy(true);
    setError(null);
    try {
      await apiPost(`/admin/anketas/${telegramId}/status`, {
        status: next,
        ...(withReason ? { reason: withReason } : {}),
      });
      // status change shifts list counts/membership and this anketa's badge
      invalidate('/admin/anketas');
      setRejectOpen(false);
      navigate('/admin');
    } catch (err) {
      setError(`Holatni o‘zgartirishda xatolik: ${(err as Error).message}`);
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <Page>
        <div className={`${s.root} ${s.rootFlat}`}>
          <div className={s.fadeTop} aria-hidden />
          <div className={s.skelHeader} aria-hidden>
            <div className={`${s.skelBar} ${s.skelName}`} />
            <div className={`${s.skelBar} ${s.skelMeta}`} />
            <div className={`${s.skelBar} ${s.skelBadge}`} />
          </div>
          {Array.from({ length: 4 }).map((_, i) => (
            <div className={s.skelSection} key={i} aria-hidden>
              <div className={`${s.skelBar} ${s.skelLabel}`} />
              <div className={`${s.skelBar} ${s.skelRow}`} />
              <div className={`${s.skelBar} ${s.skelRow} ${s.skelRow2}`} />
            </div>
          ))}
        </div>
      </Page>
    );
  }
  if (!data) {
    return <Page><div className={s.root}><div className={s.empty}>Anketa topilmadi</div></div></Page>;
  }

  const tgHandle = data.username ? `@${data.username}` : null;
  const region = REGION_LABELS[data.birthplace_region] ?? data.birthplace_region;

  return (
    <Page>
      <div className={s.root}>
        <div className={s.fadeTop} aria-hidden />

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

        {data.photos?.length > 0 && (
          <div className={s.photos}>
            {data.photos.map(p => (
              <button
                key={p.id}
                type="button"
                className={s.photo}
                onClick={() => setLightbox(p.url)}
              >
                <img src={p.url} alt="" loading="lazy" />
              </button>
            ))}
          </div>
        )}

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

        {telegramId && <MatchAssigner telegramId={telegramId} />}

        {/* status controls — show the two statuses the anketa is NOT currently in */}
        <div className={s.actions}>
          {data.status !== 'pending' && (
            <button
              type="button"
              className={`${s.btn} ${s.btnGhost}`}
              disabled={busy}
              onClick={() => applyStatus('pending')}
            >
              Kutilmoqda
            </button>
          )}
          {data.status !== 'rejected' && (
            <button
              type="button"
              className={`${s.btn} ${s.btnReject}`}
              disabled={busy}
              onClick={() => setRejectOpen(true)}
            >
              Rad etish
            </button>
          )}
          {data.status !== 'approved' && (
            <button
              type="button"
              className={`${s.btn} ${s.btnApprove}`}
              disabled={busy}
              onClick={() => applyStatus('approved')}
            >
              Tasdiqlash
            </button>
          )}
        </div>

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
                  onClick={() => applyStatus('rejected', reason)}
                  disabled={busy || !reason.trim()}
                >
                  Rad etish
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      {lightbox && <Lightbox src={lightbox} onClose={() => setLightbox(null)} />}
    </Page>
  );
};
