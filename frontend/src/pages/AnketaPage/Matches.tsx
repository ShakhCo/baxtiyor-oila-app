import { type FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { apiGet } from '@/api/client';

import s from './Matches.module.css';

type MatchCard = {
  id: number;
  full_name: string;
  age: number;
  region_label: string;
  match_percent: number;
  photos: { id: number; url: string }[];
};

type MatchResponse = { available: boolean; matches: MatchCard[] };

function firstName(full: string): string {
  return full.trim().split(/\s+/)[0] || full;
}

export const Matches: FC = () => {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ['matches'],
    queryFn: () => apiGet<MatchResponse>('/anketa/matches'),
    staleTime: 60_000, // candidate list cached for 1 minute
  });

  if (isLoading) {
    return (
      <div className={s.wrap}>
        <h3 className={s.title}>Sizga mos anketalar</h3>
        {[0, 1, 2].map(i => <div key={i} className={s.skel} aria-hidden />)}
      </div>
    );
  }

  if (!data?.available) return null; // own anketa isn't approved / has no gender

  const { matches } = data;

  return (
    <div className={s.wrap}>
      <h3 className={s.title}>Sizga mos anketalar</h3>
      {matches.length === 0 ? (
        <p className={s.empty}>Hozircha mos anketa topilmadi. Tez orada yangilanadi.</p>
      ) : (
        <div className={s.list}>
          {matches.map(m => (
            <button
              key={m.id}
              type="button"
              className={s.card}
              onClick={() => navigate(`/candidate/${m.id}`)}
            >
              {m.photos[0] ? (
                <img className={s.thumb} src={m.photos[0].url} alt="" loading="lazy" />
              ) : (
                <span className={`${s.thumb} ${s.thumbBlank}`} aria-hidden>
                  {firstName(m.full_name).charAt(0)}
                </span>
              )}
              <span className={s.cardMain}>
                <span className={s.cardName}>{firstName(m.full_name)}</span>
                <span className={s.cardMeta}>{m.age} yosh · {m.region_label}</span>
              </span>
              <span className={s.score}>{m.match_percent}%</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
