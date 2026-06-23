import { useEffect, useRef, useState, type ChangeEvent, type FC } from 'react';

import { apiDelete, apiGet, apiUpload } from '@/api/client';

import s from './PhotoUpload.module.css';

type Photo = { id: number; url: string };

const MAX = 5;

export const PhotoUpload: FC = () => {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    apiGet<{ photos: Photo[] }>('/anketa/photos')
      .then(d => setPhotos(d.photos))
      .catch(() => { /* show empty; uploads still work */ })
      .finally(() => setLoading(false));
  }, []);

  function onPick(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = ''; // allow re-picking the same file
    const room = MAX - photos.length - pending;
    const take = files.slice(0, Math.max(0, room));
    if (take.length) setError(null);
    for (const file of take) {
      const form = new FormData();
      form.append('image', file);
      setPending(p => p + 1);
      apiUpload<Photo>('/anketa/photos', form)
        .then(p => setPhotos(prev => [...prev, p]))
        .catch(err => setError(`Yuklashda xatolik: ${(err as Error).message}`))
        .finally(() => setPending(p => p - 1));
    }
  }

  function remove(id: number) {
    setPhotos(prev => prev.filter(p => p.id !== id)); // optimistic
    apiDelete(`/anketa/photos/${id}`).catch(() => {
      // restore on failure
      apiGet<{ photos: Photo[] }>('/anketa/photos').then(d => setPhotos(d.photos)).catch(() => {});
    });
  }

  const canAdd = !loading && photos.length + pending < MAX;

  return (
    <div>
      <div className={s.grid}>
        {photos.map(p => (
          <div className={s.tile} key={p.id}>
            <img className={s.img} src={p.url} alt="" loading="lazy" />
            <button
              type="button"
              className={s.remove}
              onClick={() => remove(p.id)}
              aria-label="O‘chirish"
            >
              ×
            </button>
          </div>
        ))}

        {Array.from({ length: pending }).map((_, i) => (
          <div className={`${s.tile} ${s.pending}`} key={`p${i}`} aria-hidden>
            <span className={s.spinner} />
          </div>
        ))}

        {canAdd && (
          <button type="button" className={s.add} onClick={() => inputRef.current?.click()}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <span className={s.addText}>Rasm</span>
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={onPick}
        hidden
      />

      {error && <div className={s.error}>{error}</div>}
    </div>
  );
};
