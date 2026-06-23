import { backButton } from '@tma.js/sdk-react';
import { useEffect, useMemo, useState, type ChangeEvent, type FC, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';

import { Page } from '@/components/Page.tsx';
import { apiGet, apiPost, apiPut } from '@/api/client';
import { useAnketaDraft, type FormShape, type Status } from '@/stores/anketaDraft';

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

type StepDef = {
  id: number;
  title: string;
  subtitle: string;
  required: (keyof FormShape)[];
  validate?: (form: FormShape) => boolean;
};

const STEPS: StepDef[] = [
  {
    id: 1,
    title: 'O‘zingiz haqida',
    subtitle: 'Avvalo, sizni yaqindan tanishtiring.',
    required: ['full_name', 'age', 'birthplace_region', 'current_residence_germany'],
    validate: (f) => {
      const a = Number(f.age);
      return Number.isFinite(a) && a >= 18 && a <= 99;
    },
  },
  { id: 2, title: 'Ma‘lumot va kasb', subtitle: 'Ta‘lim va mashg‘ulotingiz haqida.', required: ['education', 'profession_hobbies'] },
  { id: 3, title: 'Oilaviy holat',    subtitle: 'Oilangiz, ildizlaringiz va qadriyatlaringiz.', required: ['marital_status', 'family_info', 'nationality_languages'] },
  { id: 4, title: 'Germaniyadagi hayot', subtitle: 'Hozirgi holat va kelajak rejalari.', required: [] },
  { id: 5, title: 'Shaxsiyat va juftlik', subtitle: 'O‘zingiz va orzungizdagi umr yo‘ldosh.', required: ['self_description', 'partner_expectations'] },
  { id: 6, title: 'Tarif', subtitle: 'So‘nggi qadam — xizmat turini tanlang.', required: ['tariff'] },
];

function stepIsValid(step: StepDef, form: FormShape): boolean {
  if (step.required.some(k => !String(form[k]).trim())) return false;
  if (step.validate && !step.validate(form)) return false;
  return true;
}

// Fields shown in the read-only review of a submitted anketa.
const REVIEW_FIELDS: { key: keyof FormShape; label: string }[] = [
  { key: 'full_name',                 label: 'To‘liq ism-sharif' },
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
  const [animateSuccess, setAnimateSuccess] = useState(false); // play opening only on fresh submit
  const [regionOpen, setRegionOpen] = useState(false); // custom birthplace picker sheet

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

  // Telegram back button leaves the page (single-page form, no steps).
  useEffect(() => {
    if (loading || submitted) return;
    backButton.show();
    return backButton.onClick(() => navigate(-1));
  }, [loading, submitted, navigate]);

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

  const allValid = useMemo(() => STEPS.every(st => stepIsValid(st, form)), [form]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!allValid || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const payload = { ...form, age: Number(form.age) };
      const sender = existing ? apiPut : apiPost;
      const resp = await sender<AnketaResponse>('/anketa', payload);
      const st = resp.status ?? 'pending';
      setAnimateSuccess(true);   // play the opening animation for this fresh submit
      setSubmitted(true);
      setExisting(true);
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
          <div className={s.navBar}>
            <div className={s.navRow}>
              <button
                type="button"
                className={s.backButton}
                style={{ flex: 1 }}
                onClick={() => setViewing(false)}
              >
                ← Orqaga
              </button>
            </div>
          </div>
        </div>
      </Page>
    );
  }

  if (submitted) {
    return (
      <Page back>
        <div className={s.root}>
          <div className={s.content}>
            <div className={animateSuccess ? `${s.statusWrap} ${s.animateSuccess}` : s.statusWrap}>
              <div className={s.statusLogoWrap}>
                <picture>
                  <source srcSet="/logo.avif" type="image/avif" />
                  <img className={s.statusLogo} src="/logo.png" alt="" width={88} height={88} />
                </picture>
              </div>
              <h2 className={s.statusTitle}>Rahmat!</h2>
              <p className={s.statusText}>
                Anketangiz qabul qilindi. Tez orada admin siz bilan bog‘lanadi.
              </p>
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
                                         'Ko‘rib chiqilmoqda'}
              </span>
              {status === 'rejected' && rejection && (
                <p className={s.statusText} style={{ marginTop: 12 }}>{rejection}</p>
              )}
              <div className={s.statusActions}>
                <button
                  type="button"
                  className={s.statusViewBtn}
                  onClick={() => setViewing(true)}
                >
                  Anketani ko‘rish
                </button>
              </div>
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
            <h1 className={s.stepTitle}>Anketa to‘ldirish</h1>
            <p className={s.stepSubtitle}>Iltimos, barcha maydonlarni to‘ldiring.</p>

            <div className={s.mission}>
              <span className={s.missionLabel}>Niyatimiz</span>
              <p className={s.missionText}>
                Allohning roziligini istab, chet eldagi yoshlarimizga halol yo‘lda yor topishga yordam berish.
              </p>
            </div>
          </header>

          {error && <div className={s.errorBanner}>{error}</div>}

          <section className={s.section}>
            <h2 className={s.groupTitle}>O‘zingiz haqida</h2>

                <Field label="To‘liq ism-sharif" required>
                  <input
                    className={s.input}
                    value={form.full_name}
                    onChange={onField('full_name')}
                    placeholder="Ism Familiya"
                    autoComplete="name"
                    required
                  />
                </Field>

                <Field label="Yoshi" required>
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

                <Field label="Tug‘ilgan joyi" required>
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
                >
                  <input
                    className={s.input}
                    value={form.current_residence_germany}
                    onChange={onField('current_residence_germany')}
                    placeholder="Berlin, München, Köln…"
                    required
                  />
                </Field>

                <Field label="Bo‘yi, vazni">
                  <input
                    className={s.input}
                    value={form.height_weight}
                    onChange={onField('height_weight')}
                    placeholder="171 sm, 65 kg"
                  />
                  <div className={s.hint}>Ixtiyoriy</div>
                </Field>
            <h2 className={s.groupTitle}>Ma‘lumot va kasb</h2>

                <Field label="Ma‘lumoti va Oliygohi 📚" required>
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

                <Field label="Qaysi tarifni tanlaysiz" required>
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
        </div>

        <div className={s.navBar}>
          <div className={s.navRow}>
            <button
              type="submit"
              className={s.submitButton}
              disabled={!allValid || submitting}
            >
              {submitting ? 'Yuborilmoqda…' : 'Anketani yuborish'}
            </button>
          </div>
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
  children: React.ReactNode;
};

function Field({ label, labelRu, required, children }: FieldProps) {
  // Plain <div> wrapper (not <label>): a <select> nested inside a <label>
  // fails to open its native picker on tap in iOS / Telegram webviews.
  return (
    <div className={s.field}>
      <span className={s.label}>
        {label}
        {required && <span className={s.required}>*</span>}
        {labelRu && <span className={s.labelRu}>{labelRu}</span>}
      </span>
      {children}
    </div>
  );
}
