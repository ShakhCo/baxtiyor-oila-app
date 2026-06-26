import { backButton } from '@tma.js/sdk-react';
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FC, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';

import { Page } from '@/components/Page.tsx';
import { apiGet, apiPost, apiPut } from '@/api/client';
import { useAnketaDraft, type FormShape, type Status } from '@/stores/anketaDraft';

import { Matches } from './Matches';
import { PhotoUpload } from './PhotoUpload';
import s from './AnketaPage.module.css';

const REGIONS = [
  { value: 'andijon',          label: 'Andijon' },
  { value: 'buxoro',           label: 'Buxoro' },
  { value: 'fargona',          label: 'Farg‘ona' },
  { value: 'jizzax',           label: 'Jizzax' },
  { value: 'namangan',         label: 'Namangan' },
  { value: 'navoiy',           label: 'Navoiy' },
  { value: 'qashqadaryo',      label: 'Qashqadaryo' },
  { value: 'qoraqalpogiston',  label: 'Qoraqalpog‘iston Respublikasi' },
  { value: 'samarqand',        label: 'Samarqand' },
  { value: 'sirdaryo',         label: 'Sirdaryo' },
  { value: 'surxandaryo',      label: 'Surxandaryo' },
  { value: 'toshkent_shahar',  label: 'Toshkent shahar' },
  { value: 'toshkent_viloyat', label: 'Toshkent viloyat' },
  { value: 'xorazm',           label: 'Xorazm' },
] as const;

type AnketaResponse =
  & { submitted: boolean; status?: Status; rejection_reason?: string }
  & Partial<Record<keyof FormShape, string | number>>;

// Per-field validation. Returns a short Uzbek error message, or null when the
// field is acceptable. Required fields reject empty input; free-text fields get
// a sane min/max length; structured fields (age, gender, region, tariff) are
// checked against their allowed shape so a user can't submit a wrong value.
// Keep these rules in sync with the backend serializer (profiles/serializers.py).
const NAME_OK = /^[\p{L}][\p{L}\s.'‘’-]*$/u;

function fieldError(key: keyof FormShape, form: FormShape): string | null {
  const v = String(form[key] ?? '').trim();
  switch (key) {
    case 'full_name':
      if (!v) return 'Ism-sharifingizni kiriting.';
      if (v.length < 3) return 'Ism-sharif kamida 3 ta harfdan iborat bo‘lsin.';
      if (v.length > 100) return 'Ism-sharif juda uzun (100 belgigacha).';
      if (!NAME_OK.test(v)) return 'Ism-sharifda faqat harflar bo‘lsin.';
      return null;

    case 'gender':
      return v === 'male' || v === 'female' ? null : 'Jinsingizni tanlang.';

    case 'age': {
      if (!v) return 'Yoshingizni kiriting.';
      if (!/^\d{1,3}$/.test(v)) return 'Yosh butun son bo‘lishi kerak.';
      const a = Number(v);
      if (a < 18 || a > 99) return 'Yosh 18 dan 99 gacha bo‘lishi kerak.';
      return null;
    }

    case 'birthplace_region':
      return REGIONS.some(r => r.value === v) ? null : 'Tug‘ilgan joyingizni tanlang.';

    case 'current_residence_germany':
      if (!v) return 'Hozir istiqomat qiladigan shaharni kiriting.';
      if (v.length < 2) return 'Juda qisqa.';
      if (v.length > 120) return 'Juda uzun (120 belgigacha).';
      return null;

    case 'tariff':
      return v === 'basic' || v === 'standart' ? null : 'Tarifni tanlang.';

    case 'education':
      if (!v) return 'Ma‘lumotingizni kiriting.';
      if (v.length < 2) return 'Juda qisqa.';
      if (v.length > 500) return 'Juda uzun (500 belgigacha).';
      return null;

    case 'profession_hobbies':
    case 'marital_status':
    case 'family_info':
    case 'nationality_languages':
    case 'self_description':
    case 'partner_expectations':
      if (!v) return 'Bu maydonni to‘ldiring.';
      if (v.length < 2) return 'Juda qisqa.';
      if (v.length > 2000) return 'Juda uzun (2000 belgigacha).';
      return null;

    // optional free-text fields — only guard the upper bound
    case 'height_weight':
    case 'religion':
    case 'germany_status':
      if (v.length > 1000) return 'Juda uzun (1000 belgigacha).';
      return null;

    default:
      return null;
  }
}

// Fields shown in the read-only review of a submitted anketa.
const REVIEW_FIELDS: { key: keyof FormShape; label: string }[] = [
  { key: 'full_name',                 label: 'To‘liq ism-sharif' },
  { key: 'gender',                    label: 'Jinsi' },
  { key: 'age',                       label: 'Yoshi' },
  { key: 'birthplace_region',         label: 'Tug‘ilgan joyi' },
  { key: 'current_residence_germany', label: 'Olmoniyadagi shahar' },
  { key: 'height_weight',             label: 'Bo‘yi, vazni' },
  { key: 'education',                 label: 'Ma‘lumoti' },
  { key: 'profession_hobbies',        label: 'Kasbi, qiziqishlari' },
  { key: 'marital_status',            label: 'Oilaviy holati' },
  { key: 'family_info',               label: 'Oila ma‘lumoti' },
  { key: 'nationality_languages',     label: 'Millati va tillari' },
  { key: 'religion',                  label: 'Diniy munosabati' },
  { key: 'germany_status',            label: 'Germaniyadagi statusi' },
  { key: 'self_description',          label: 'O‘ziga ta‘rif' },
  { key: 'partner_expectations',      label: 'Kutilgan juftlik' },
  { key: 'tariff',                    label: 'Tarif' },
];

function reviewValue(key: keyof FormShape, form: FormShape): string {
  const raw = form[key];
  if (!raw) return '';
  if (key === 'gender') {
    return raw === 'male' ? 'Erkak' : raw === 'female' ? 'Ayol' : '';
  }
  if (key === 'birthplace_region') {
    return REGIONS.find(r => r.value === raw)?.label ?? String(raw);
  }
  if (key === 'tariff') {
    return raw === 'basic' ? 'Basic · 20 €' : raw === 'standart' ? 'Standart · 50 €' : '';
  }
  return String(raw);
}

export const AnketaPage: FC = () => {
  const navigate = useNavigate();
  // Form draft + step live in a localStorage-persisted store, so reloads
  // (or accidental closes) never lose what's been typed before submission.
  const form     = useAnketaDraft(st => st.form);
  const setForm  = useAnketaDraft(st => st.setForm);
  const setField = useAnketaDraft(st => st.setField);
  const setSubmittedStatus = useAnketaDraft(st => st.setSubmittedStatus);

  // Synchronously read the cached submission so a returning user lands straight
  // on the success screen (no loading flash, no re-played opening animation).
  const cachedStatus = useAnketaDraft.getState().submittedStatus;

  const [loading, setLoading] = useState(cachedStatus == null);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus]   = useState<Status | null>(cachedStatus);
  const [rejection, setRejection] = useState<string>('');
  const [submitted, setSubmitted] = useState(cachedStatus != null);
  const [existing, setExisting]   = useState(cachedStatus != null);
  const [error, setError]     = useState<string | null>(null);
  const [viewing, setViewing] = useState(false); // read-only view of submitted anketa
  const [editing, setEditing] = useState(false); // re-open the form to edit a pending anketa
  const [regionOpen, setRegionOpen] = useState(false); // custom birthplace picker sheet
  const [showErrors, setShowErrors] = useState(false);  // reveal per-field errors after a submit attempt
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    apiGet<AnketaResponse>('/anketa')
      .then(data => {
        if (data.submitted) {
          const st = data.status ?? 'pending';
          setSubmitted(true);
          setExisting(true);
          setStatus(st);
          setSubmittedStatus(st); // cache for an instant success screen next time
          setRejection(data.rejection_reason ?? '');
          setForm({
            full_name:                 String(data.full_name ?? ''),
            gender:                    (data.gender === 'male' || data.gender === 'female') ? data.gender : '',
            age:                       data.age != null ? String(data.age) : '',
            birthplace_region:         String(data.birthplace_region ?? ''),
            current_residence_germany: String(data.current_residence_germany ?? ''),
            height_weight:             String(data.height_weight ?? ''),
            education:                 String(data.education ?? ''),
            profession_hobbies:        String(data.profession_hobbies ?? ''),
            marital_status:            String(data.marital_status ?? ''),
            family_info:               String(data.family_info ?? ''),
            nationality_languages:     String(data.nationality_languages ?? ''),
            religion:                  String(data.religion ?? ''),
            germany_status:            String(data.germany_status ?? ''),
            self_description:          String(data.self_description ?? ''),
            partner_expectations:      String(data.partner_expectations ?? ''),
            contact_info:              String(data.contact_info ?? ''),
            tariff:                    (data.tariff === 'basic' || data.tariff === 'standart') ? data.tariff : '',
          });
        } else {
          // Server says there's no anketa — drop any stale cache and show the form.
          setSubmitted(false);
          setStatus(null);
          setSubmittedStatus(null);
        }
      })
      .catch(err => {
        // Keep showing a cached success screen if we're offline / auth hiccups;
        // only surface the error when we had nothing cached to show.
        if (cachedStatus == null) setError(`Anketani olishda xatolik: ${err.message}`);
      })
      .finally(() => setLoading(false));
  }, []);

  // Telegram back button: in the read-only review it returns to the status
  // screen; on the form it leaves the page. (Status/approved screens have none.)
  useEffect(() => {
    if (submitted && viewing) {
      backButton.show();
      return backButton.onClick(() => setViewing(false));
    }
    if (submitted && editing) {
      backButton.show();
      return backButton.onClick(() => setEditing(false));
    }
    if (!loading && !submitted) {
      backButton.show();
      return backButton.onClick(() => navigate(-1));
    }
  }, [loading, submitted, viewing, editing, navigate]);

  function onField<K extends keyof FormShape>(key: K) {
    return (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setField(key, e.target.value as FormShape[K]);
    };
  }

  // When an input/select/textarea gains focus, wait for the soft keyboard
  // animation, then scroll the field into the centre of the viewport so it
  // isn't hidden behind the keyboard or the sticky submit bar.
  function onFormFocus(e: React.FocusEvent<HTMLFormElement>) {
    const t = e.target;
    if (
      t instanceof HTMLInputElement ||
      t instanceof HTMLTextAreaElement ||
      t instanceof HTMLSelectElement
    ) {
      setTimeout(() => {
        t.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 280);
    }
  }

  // Validate every field once; drives submit-gating, the inline messages, and
  // the "what's wrong" summary banner.
  const fieldErrors = useMemo(() => {
    const errs: Partial<Record<keyof FormShape, string>> = {};
    for (const { key } of REVIEW_FIELDS) {
      const msg = fieldError(key, form);
      if (msg) errs[key] = msg;
    }
    return errs;
  }, [form]);
  const allValid = useMemo(() => Object.keys(fieldErrors).length === 0, [fieldErrors]);
  // Only surface a field's error once the user has tried to submit.
  const errOf = (key: keyof FormShape) => (showErrors ? fieldErrors[key] : undefined);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    if (!allValid) {
      // Reveal inline errors and tell the user exactly what to fix, then jump to
      // the first offending field — instead of a silently-disabled button.
      setShowErrors(true);
      const bad = REVIEW_FIELDS.filter(f => fieldErrors[f.key]);
      setError(`Iltimos, quyidagi maydonlarni to‘g‘ri to‘ldiring: ${bad.map(f => f.label).join(', ')}.`);
      const firstKey = bad[0]?.key;
      requestAnimationFrame(() => {
        const el = firstKey ? document.getElementById(`field-${firstKey}`) : errorRef.current;
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const payload = { ...form, age: Number(form.age) };
      const sender = existing ? apiPut : apiPost;
      const resp = await sender<AnketaResponse>('/anketa', payload);
      const st = resp.status ?? 'pending';
      setSubmitted(true);
      setExisting(true);
      setEditing(false);         // an edit was saved → return to the status screen
      setStatus(st);
      setSubmittedStatus(st);    // cache so future visits skip the loading screen
    } catch (err) {
      const e = err as Error;
      setError(`Yuborishda xatolik: ${e.message}`);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <Page back>
        <div className={s.root}>
          <div className={s.content}>
            <div className={s.loadingWrap}>
              <picture>
                <source srcSet="/logo.avif" type="image/avif" />
                <img className={s.loadingLogo} src="/logo.png" alt="" width={72} height={72} />
              </picture>
              <span className={s.loadingText}>Yuklanmoqda…</span>
            </div>
          </div>
        </div>
      </Page>
    );
  }

  if (submitted && viewing) {
    return (
      <Page back={false}>
        <div className={s.root}>
          <div className={s.content}>
            <header className={s.formHeader}>
              <h1 className={s.stepTitle}>Anketangiz</h1>
              <p className={s.stepSubtitle}>Yuborilgan ma‘lumotlar</p>
            </header>

            <PhotoUpload readOnly />

            <div className={s.review}>
              {REVIEW_FIELDS.map(f => {
                const value = reviewValue(f.key, form);
                if (!value) return null;
                return (
                  <div className={s.reviewRow} key={f.key}>
                    <span className={s.reviewLabel}>{f.label}</span>
                    <span className={s.reviewValue}>{value}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </Page>
    );
  }

  // approved → a compact banner + the opposite-gender match feed
  if (submitted && status === 'approved') {
    return (
      <Page back>
        <div className={s.root}>
          <div className={s.content}>
            <header className={s.approvedHead}>
              <span className={`${s.statusBadge} ${s.statusApproved}`}>Tasdiqlangan</span>
              <button type="button" className={s.viewLink} onClick={() => setViewing(true)}>
                Anketangiz →
              </button>
            </header>
            <Matches />
          </div>
        </div>
      </Page>
    );
  }

  if (submitted && !editing) {
    return (
      <Page back>
        <div className={s.root}>
          <div className={s.content}>
            <header className={s.statusHeader}>
              <h1 className={s.statusHeading}>Anketangiz</h1>
              <p className={s.statusLead}>
                {status === 'rejected'
                  ? 'Anketangiz qaytarildi. Tahrirlab, qaytadan yuboring.'
                  : 'Admin tomonidan tasdiqlangach, sizga mos nomzodlar ro‘yxatini ko‘rasiz.'}
              </p>
            </header>

            <div className={s.statusCard}>
              <span
                className={[
                  s.statusBadge,
                  status === 'approved' ? s.statusApproved :
                  status === 'rejected' ? s.statusRejected :
                                          s.statusPending,
                ].join(' ')}
              >
                {status === 'approved' ? 'Tasdiqlangan' :
                 status === 'rejected' ? 'Rad etilgan' :
                                         'To‘lov kutilmoqda'}
              </span>
              <p className={s.statusCardText}>
                {status === 'rejected'
                  ? 'Quyidagi izohga ko‘ra ma‘lumotlarni to‘g‘rilang.'
                  : 'Anketangiz qabul qilindi. To‘lov tasdiqlangach, admin anketangizni ko‘rib chiqadi.'}
              </p>
              {status === 'rejected' && rejection && (
                <p className={s.statusReason}>{rejection}</p>
              )}
            </div>

            <div className={s.statusActions}>
              {status !== 'rejected' && (
                <button
                  type="button"
                  className={s.statusPrimaryBtn}
                  onClick={() => navigate('/chat')}
                >
                  Admin bilan suhbat
                </button>
              )}
              <button
                type="button"
                className={status !== 'rejected' ? s.statusSecondaryBtn : s.statusPrimaryBtn}
                onClick={() => { setError(null); setEditing(true); }}
              >
                Anketani tahrirlash
              </button>
            </div>
          </div>
        </div>
      </Page>
    );
  }

  return (
    <Page back={false}>
      <form className={s.root} onSubmit={onSubmit} onFocus={onFormFocus} noValidate>
        <div className={s.fadeTop} aria-hidden />
        <div className={s.content}>
          <header className={s.formHeader}>
            <h1 className={s.stepTitle}>{editing ? 'Anketani tahrirlash' : 'Anketa to‘ldirish'}</h1>
            <p className={s.stepSubtitle}>
              {editing ? 'Ma‘lumotlarni yangilang.' : 'Iltimos, barcha maydonlarni to‘ldiring.'}
            </p>

            <div className={s.mission}>
              <span className={s.missionLabel}>Niyatimiz</span>
              <p className={s.missionText}>
                Allohning roziligini istab, chet eldagi yoshlarimizga halol yo‘lda yor topishga yordam berish.
              </p>
            </div>
          </header>

          {error && <div ref={errorRef} className={s.errorBanner}>{error}</div>}

          <section className={s.section}>
            <h2 className={s.groupTitle}>O‘zingiz haqida</h2>

                <Field label="To‘liq ism-sharif" required id="field-full_name" error={errOf('full_name')}>
                  <input
                    className={s.input}
                    value={form.full_name}
                    onChange={onField('full_name')}
                    placeholder="Ism Familiya"
                    autoComplete="name"
                    required
                  />
                </Field>

                <Field label="Jinsi" required id="field-gender" error={errOf('gender')}>
                  <div className={s.segmented} role="radiogroup" aria-label="Jinsi">
                    <button
                      type="button"
                      role="radio"
                      aria-checked={form.gender === 'male'}
                      className={form.gender === 'male' ? `${s.segment} ${s.segmentOn}` : s.segment}
                      onClick={() => setField('gender', 'male')}
                    >
                      Erkak
                    </button>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={form.gender === 'female'}
                      className={form.gender === 'female' ? `${s.segment} ${s.segmentOn}` : s.segment}
                      onClick={() => setField('gender', 'female')}
                    >
                      Ayol
                    </button>
                  </div>
                </Field>

                <Field label="Yoshi" required id="field-age" error={errOf('age')}>
                  <input
                    className={s.input}
                    type="number"
                    inputMode="numeric"
                    min={18}
                    max={99}
                    value={form.age}
                    onChange={onField('age')}
                    placeholder="18 — 99"
                    required
                  />
                </Field>

                <Field label="Tug‘ilgan joyi" required id="field-birthplace_region" error={errOf('birthplace_region')}>
                  <button
                    type="button"
                    className={form.birthplace_region ? s.selectBtn : `${s.selectBtn} ${s.selectBtnEmpty}`}
                    onClick={() => setRegionOpen(true)}
                  >
                    {form.birthplace_region
                      ? (REGIONS.find(r => r.value === form.birthplace_region)?.label ?? form.birthplace_region)
                      : 'Tanlang…'}
                  </button>
                </Field>

                <Field
                  label="Olmoniyada hozirda istiqomat qiladigan joy"
                  required
                  id="field-current_residence_germany"
                  error={errOf('current_residence_germany')}
                >
                  <input
                    className={s.input}
                    value={form.current_residence_germany}
                    onChange={onField('current_residence_germany')}
                    placeholder="Berlin, München, Köln…"
                    required
                  />
                </Field>

                <Field label="Bo‘yi, vazni" id="field-height_weight" error={errOf('height_weight')}>
                  <input
                    className={s.input}
                    value={form.height_weight}
                    onChange={onField('height_weight')}
                    placeholder="171 sm, 65 kg"
                  />
                  <div className={s.hint}>Ixtiyoriy</div>
                </Field>

                <Field label="Rasmlaringiz">
                  <PhotoUpload />
                  <div className={s.hint}>Ixtiyoriy · 5 tagacha rasm</div>
                </Field>

            <h2 className={s.groupTitle}>Ma‘lumot va kasb</h2>

                <Field label="Ma‘lumoti va Oliygohi 📚" required id="field-education" error={errOf('education')}>
                  <input
                    className={s.input}
                    value={form.education}
                    onChange={onField('education')}
                    placeholder="TUIT bakalavr, …"
                    required
                  />
                </Field>

                <Field
                  label="Kasbi, mutaxassisligi, qiziqishlari va xobbiysi"
                  required
                  id="field-profession_hobbies"
                  error={errOf('profession_hobbies')}
                >
                  <textarea
                    className={s.textarea}
                    value={form.profession_hobbies}
                    onChange={onField('profession_hobbies')}
                    placeholder="Ish joyi va lavozim — ixtiyoriy"
                    rows={4}
                    required
                  />
                </Field>
            <h2 className={s.groupTitle}>Oilaviy holat</h2>

                <Field
                  label="Oilaviy holati (turmush qurmagan / ajrashgan, farzandlar)"
                  required
                  id="field-marital_status"
                  error={errOf('marital_status')}
                >
                  <textarea
                    className={s.textarea}
                    value={form.marital_status}
                    onChange={onField('marital_status')}
                    rows={3}
                    required
                  />
                </Field>

                <Field
                  label="Oilada necha farzand va ota-onasi kimlar"
                  required
                  id="field-family_info"
                  error={errOf('family_info')}
                >
                  <textarea
                    className={s.textarea}
                    value={form.family_info}
                    onChange={onField('family_info')}
                    rows={3}
                    required
                  />
                </Field>

                <Field
                  label="Millati, ona tili va boshqa tillar"
                  required
                  id="field-nationality_languages"
                  error={errOf('nationality_languages')}
                >
                  <textarea
                    className={s.textarea}
                    value={form.nationality_languages}
                    onChange={onField('nationality_languages')}
                    rows={3}
                    required
                  />
                </Field>

                <Field
                  label="Din va unga bo‘lgan munosabati"
                  id="field-religion"
                  error={errOf('religion')}
                >
                  <textarea
                    className={s.textarea}
                    value={form.religion}
                    onChange={onField('religion')}
                    placeholder="Doimiy amaliy ibodat / goh-goh / din muhim emas …"
                    rows={3}
                  />
                  <div className={s.hint}>Ixtiyoriy</div>
                </Field>
            <h2 className={s.groupTitle}>Germaniyadagi hayot</h2>

              <Field
                label="Germaniyadagi statusi va kelajak rejalari"
                id="field-germany_status"
                error={errOf('germany_status')}
              >
                <textarea
                  className={s.textarea}
                  value={form.germany_status}
                  onChange={onField('germany_status')}
                  placeholder="Fuqarolik / PMJ / moviy karta / talaba / …"
                  rows={4}
                />
                <div className={s.hint}>Ixtiyoriy — bo‘sh qoldirsangiz ham bo‘ladi</div>
              </Field>

            <h2 className={s.groupTitle}>Shaxsiyat va juftlik</h2>

                <Field
                  label="O‘zingizga ta‘rif bering"
                  required
                  id="field-self_description"
                  error={errOf('self_description')}
                >
                  <textarea
                    className={s.textarea}
                    value={form.self_description}
                    onChange={onField('self_description')}
                    placeholder="Talabchan, emotsional, tez kirishuvchan…"
                    rows={4}
                    required
                  />
                </Field>

                <Field
                  label="Sizning idealingizdagi umr yo‘ldoshi va talablari"
                  required
                  id="field-partner_expectations"
                  error={errOf('partner_expectations')}
                >
                  <textarea
                    className={s.textarea}
                    value={form.partner_expectations}
                    onChange={onField('partner_expectations')}
                    placeholder="Pazanda, mehnatsevar, ochiq ko‘ngil …"
                    rows={5}
                    required
                  />
                </Field>
            <h2 className={s.groupTitle}>Tarif</h2>

                <Field label="Qaysi tarifni tanlaysiz" required id="field-tariff" error={errOf('tariff')}>
                  <div className={s.tariffGroup}>
                    <label className={`${s.tariffOption} ${form.tariff === 'basic' ? s.tariffSelected : ''}`}>
                      <input
                        type="radio"
                        name="tariff"
                        value="basic"
                        checked={form.tariff === 'basic'}
                        onChange={onField('tariff')}
                      />
                      <span>
                        <span className={s.tariffName}>Basic</span>
                        <div className={s.tariffDesc}>
                          O‘zingizga vakil tayinlaysiz. Anketada vakilingiz kontakti ko‘rsatiladi.
                        </div>
                      </span>
                      <span className={s.tariffPrice}>20 €</span>
                    </label>

                    <label className={`${s.tariffOption} ${form.tariff === 'standart' ? s.tariffSelected : ''}`}>
                      <input
                        type="radio"
                        name="tariff"
                        value="standart"
                        checked={form.tariff === 'standart'}
                        onChange={onField('tariff')}
                      />
                      <span>
                        <span className={s.tariffName}>Standart</span>
                        <div className={s.tariffDesc}>
                          Admin sizning vakilingiz bo‘ladi. Sizga mos nomzodlar bilan muloqot o‘rnatadi.
                        </div>
                      </span>
                      <span className={s.tariffPrice}>50 €</span>
                    </label>
                  </div>
                </Field>
          </section>

          <button
            type="submit"
            className={s.submitButton}
            disabled={submitting}
          >
            {submitting ? 'Yuborilmoqda…' : editing ? 'O‘zgarishlarni saqlash' : 'Anketani yuborish'}
          </button>
        </div>
      </form>

      {regionOpen && (
        <div className={s.sheetBackdrop} onClick={() => setRegionOpen(false)}>
          <div className={s.sheet} onClick={e => e.stopPropagation()}>
            <h2 className={s.sheetTitle}>Tug‘ilgan joyi</h2>
            <div className={s.options}>
              {REGIONS.map(r => {
                const active = form.birthplace_region === r.value;
                return (
                  <button
                    key={r.value}
                    type="button"
                    className={active ? `${s.option} ${s.optionActive}` : s.option}
                    onClick={() => { setField('birthplace_region', r.value); setRegionOpen(false); }}
                  >
                    {r.label}
                    {active && <span className={s.optionCheck} aria-hidden>✓</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </Page>
  );
};

/* ───── small Field wrapper ───── */
type FieldProps = {
  label: string;
  labelRu?: string;
  required?: boolean;
  id?: string;
  error?: string;
  children: React.ReactNode;
};

function Field({ label, labelRu, required, id, error, children }: FieldProps) {
  // Plain <div> wrapper (not <label>): a <select> nested inside a <label>
  // fails to open its native picker on tap in iOS / Telegram webviews.
  return (
    <div id={id} className={error ? `${s.field} ${s.fieldInvalid}` : s.field}>
      <span className={s.label}>
        {label}
        {required && <span className={s.required}>*</span>}
        {labelRu && <span className={s.labelRu}>{labelRu}</span>}
      </span>
      {children}
      {error && <span className={s.fieldError}>{error}</span>}
    </div>
  );
}
