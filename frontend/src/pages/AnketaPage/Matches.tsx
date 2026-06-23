import { useEffect, useState, type FC } from 'react';

import { apiGet } from '@/api/client';

import s from './Matches.module.css';

export type Match = {
  full_name: string;
  gender: 'male' | 'female' | '';
  age: number;
  birthplace_region: string;
  region_label: string;
  current_residence_germany: string;
  height_weight: string;
  education: string;
  profession_hobbies: string;
  marital_status: string;
  family_info: string;
  nationality_languages: string;
  religion: string;
  germany_status: string;
  self_description: string;
  partner_expectations: string;
};

type MatchResponse = { available: boolean; reason?: string; matches: Match[] };

const GENDER_LABEL: Record<string, string> = { male: 'Erkak', female: 'Ayol' };

function Row({ label, value }: { label: string; value?: string }) {
  if (!value || !value.trim()) return null;
  return (
    <div className={s.row}>
      <span className={s.rowLabel}>{label}</span>
      <span className={s.rowValue}>{value}</span>
    </div>
  );
}

function MatchSheet({ match, onClose }: { match: Match; onClose: () => void }) {
  return (
    <div className={s.backdrop} onClick={onClose}>
      <div className={s.sheet} onClick={e => e.stopPropagation()}>
        <span className={s.grip} aria-hidden />
        <div className={s.sheetScroll}>
          <h2 className={s.sheetName}>{match.full_name}</h2>
          <p className={s.sheetSub}>
            {match.age} yosh{match.gender ? ` · ${GENDER_LABEL[match.gender]}` : ''}
          </p>
          <Row label="Tug‘ilgan joyi" value={match.region_label} />
          <Row label="Olmoniyadagi shahar" value={match.current_residence_germany} />
          <Row label="Bo‘yi, vazni" value={match.height_weight} />
          <Row label="Ma‘lumoti" value={match.education} />
          <Row label="Kasbi, qiziqishlari" value={match.profession_hobbies} />
          <Row label="Oilaviy holati" value={match.marital_status} />
          <Row label="Oila ma‘lumoti" value={match.family_info} />
          <Row label="Millati va tillari" value={match.nationality_languages} />
          <Row label="Diniy munosabati" value={match.religion} />
          <Row label="Germaniyadagi statusi" value={match.germany_status} />
          <Row label="O‘ziga ta‘rif" value={match.self_description} />
          <Row label="Kutilgan juftlik" value={match.partner_expectations} />
        </div>
        <button type="button" className={s.closeBtn} onClick={onClose}>Yopish</button>
      </div>
    </div>
  );
}

export const Matches: FC = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<MatchResponse | null>(null);
  const [open, setOpen] = useState<Match | null>(null);

  useEffect(() => {
    apiGet<MatchResponse>('/anketa/matches')
      .then(setData)
      .catch(() => setData({ available: false, matches: [] }))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className={s.wrap}>
        <h3 className={s.title}>Sizga mos anketalar</h3>
        {[0, 1, 2].map(i => <div key={i} className={s.skel} aria-hidden />)}
      </div>
    );
  }

  // own anketa isn't approved / has no gender yet — nothing to show here
  if (!data?.available) return null;

  const { matches } = data;

  return (
    <div className={s.wrap}>
      <h3 className={s.title}>Sizga mos anketalar</h3>
      {matches.length === 0 ? (
        <p className={s.empty}>Hozircha mos anketa topilmadi. Tez orada yangilanadi.</p>
      ) : (
        <div className={s.list}>
          {matches.map((m, i) => (
            <button key={i} type="button" className={s.card} onClick={() => setOpen(m)}>
              <span className={s.cardMain}>
                <span className={s.cardName}>{m.full_name}</span>
                <span className={s.cardMeta}>
                  {m.age} yosh · {m.region_label}
                  {m.current_residence_germany ? ` · ${m.current_residence_germany}` : ''}
                </span>
                {m.self_description?.trim() && (
                  <span className={s.cardDesc}>{m.self_description}</span>
                )}
              </span>
              <span className={s.chevron} aria-hidden>›</span>
            </button>
          ))}
        </div>
      )}

      {open && <MatchSheet match={open} onClose={() => setOpen(null)} />}
    </div>
  );
};
