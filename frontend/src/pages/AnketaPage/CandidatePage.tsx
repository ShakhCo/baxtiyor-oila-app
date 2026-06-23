import { type FC, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { Page } from '@/components/Page.tsx';
import { apiGet } from '@/api/client';

import s from './CandidatePage.module.css';

type Candidate = {
  full_name: string;
  gender: 'male' | 'female' | '';
  age: number;
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
  match_percent: number;
  match_reasons: string[];
  photos: { id: number; url: string }[];
};

const GENDER_LABEL: Record<string, string> = { male: 'Erkak', female: 'Ayol' };

function joinUz(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? '';
  return `${parts.slice(0, -1).join(', ')} va ${parts[parts.length - 1]}`;
}

function Row({ label, value }: { label: string; value?: string }) {
  if (!value || !value.trim()) return null;
  return (
    <div className={s.row}>
      <span className={s.rowLabel}>{label}</span>
      <span className={s.rowValue}>{value}</span>
    </div>
  );
}

export const CandidatePage: FC = () => {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, isError } = useQuery({
    queryKey: ['candidate', id],
    queryFn: () => apiGet<Candidate>(`/anketa/matches/${id}`),
    staleTime: 5 * 60_000, // candidate details cached for 5 minutes
    enabled: !!id,
  });

  let body: ReactNode;
  if (isLoading) {
    body = <div className={s.note}>Yuklanmoqda…</div>;
  } else if (isError || !data) {
    body = <div className={s.note}>Anketa topilmadi</div>;
  } else {
    body = (
      <>
        <header className={s.header}>
          <div className={s.headRow}>
            <h1 className={s.name}>{data.full_name}</h1>
            <span className={s.score}>{data.match_percent}% mos</span>
          </div>
          <p className={s.sub}>
            {data.age} yosh
            {data.gender ? ` · ${GENDER_LABEL[data.gender]}` : ''}
            {data.region_label ? ` · ${data.region_label}` : ''}
          </p>
          <p className={s.statement}>
            {data.match_reasons.length > 0
              ? `Bu nomzod siz bilan ${joinUz(data.match_reasons)}.`
              : 'Hozircha umumiy belgilar kam, ammo tanishib ko‘rishingiz mumkin.'}
          </p>
        </header>

        {data.photos.length > 0 && (
          <div className={s.gallery}>
            {data.photos.map(p => (
              <a key={p.id} className={s.galleryItem} href={p.url} target="_blank" rel="noreferrer">
                <img src={p.url} alt="" loading="lazy" />
              </a>
            ))}
          </div>
        )}

        <div className={s.section}>
          <Row label="Tug‘ilgan joyi" value={data.region_label} />
          <Row label="Olmoniyadagi shahar" value={data.current_residence_germany} />
          <Row label="Bo‘yi, vazni" value={data.height_weight} />
          <Row label="Ma‘lumoti" value={data.education} />
          <Row label="Kasbi, qiziqishlari" value={data.profession_hobbies} />
          <Row label="Oilaviy holati" value={data.marital_status} />
          <Row label="Oila ma‘lumoti" value={data.family_info} />
          <Row label="Millati va tillari" value={data.nationality_languages} />
          <Row label="Diniy munosabati" value={data.religion} />
          <Row label="Germaniyadagi statusi" value={data.germany_status} />
          <Row label="O‘ziga ta‘rif" value={data.self_description} />
          <Row label="Kutilgan juftlik" value={data.partner_expectations} />
        </div>
      </>
    );
  }

  return (
    <Page back>
      <div className={s.root}>
        <div className={s.fadeTop} aria-hidden />
        {body}
      </div>
    </Page>
  );
};
