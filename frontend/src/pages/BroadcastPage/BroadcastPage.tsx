import { useEffect, useRef, useState, type ChangeEvent, type FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';

import { Page } from '@/components/Page.tsx';
import { apiGet, apiUpload } from '@/api/client';

import s from './BroadcastPage.module.css';
import sheet from '@/pages/ChatPage/ChatPage.module.css';

type Broadcast = { id: number };
type Payload = { user_count: number };

const MAX_PHOTOS = 10;

type PhotoPick = { file: File; url: string };

function HistoryIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 12a8 8 0 1 0 2.5-5.8M4 4v3h3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export const BroadcastPage: FC = () => {
  const navigate = useNavigate();
  const [text, setText] = useState('');
  const [photos, setPhotos] = useState<PhotoPick[]>([]);
  const [confirm, setConfirm] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data } = useQuery({
    queryKey: ['broadcast-user-count'],
    queryFn: () => apiGet<Payload>('/admin/broadcasts'),
    staleTime: 60_000,
  });
  const userCount = data?.user_count ?? 0;

  // revoke object URLs on unmount so previews don't leak
  useEffect(() => () => { photos.forEach(p => URL.revokeObjectURL(p.url)); }, [photos]);

  function onPick(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    const room = MAX_PHOTOS - photos.length;
    const take = files.slice(0, Math.max(0, room));
    setPhotos(prev => [...prev, ...take.map(f => ({ file: f, url: URL.createObjectURL(f) }))]);
  }

  function removePhoto(url: string) {
    URL.revokeObjectURL(url);
    setPhotos(prev => prev.filter(p => p.url !== url));
  }

  const send = useMutation({
    mutationFn: () => {
      const form = new FormData();
      form.append('text', text.trim());
      photos.forEach(p => form.append('images', p.file));
      return apiUpload<Broadcast>('/admin/broadcasts', form);
    },
    onSuccess: () => {
      photos.forEach(p => URL.revokeObjectURL(p.url));
      setText('');
      setPhotos([]);
      setConfirm(false);
      navigate('/admin/broadcast/history');
    },
  });

  const canSend = (text.trim().length > 0 || photos.length > 0) && !send.isPending;

  return (
    <Page back>
      <div className={s.root}>
        <header className={s.header}>
          <div className={s.headerRow}>
            <p className={s.eyebrow}>{userCount.toLocaleString('uz-UZ')} foydalanuvchi</p>
            <button
              type="button"
              className={s.historyLink}
              onClick={() => navigate('/admin/broadcast/history')}
            >
              <HistoryIcon />
              Yuborilganlar
            </button>
          </div>
          <h1 className={s.title}>Ommaviy xabar</h1>
        </header>

        <textarea
          className={s.textarea}
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Hammaga yuboriladigan xabar…"
          rows={5}
        />

        <div className={s.photos}>
          {photos.map(p => (
            <div className={s.thumb} key={p.url}>
              <img className={s.thumbImg} src={p.url} alt="" />
              <button type="button" className={s.thumbRemove} onClick={() => removePhoto(p.url)} aria-label="O‘chirish">×</button>
            </div>
          ))}
          {photos.length < MAX_PHOTOS && (
            <button type="button" className={s.addPhoto} onClick={() => fileRef.current?.click()}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <span className={s.addPhotoText}>Rasm</span>
            </button>
          )}
        </div>
        <p className={s.photoHint}>Ixtiyoriy · {MAX_PHOTOS} tagacha rasm</p>

        <input ref={fileRef} type="file" accept="image/*" multiple onChange={onPick} hidden />

        <button type="button" className={s.send} disabled={!canSend} onClick={() => setConfirm(true)}>
          Yuborish
        </button>

        {confirm && (
          <div className={sheet.sheetBackdrop} onClick={() => setConfirm(false)}>
            <div className={sheet.sheet} onClick={e => e.stopPropagation()}>
              <h2 className={sheet.sheetTitle}>Tasdiqlang</h2>
              <p className={sheet.sheetHint}>
                Ushbu xabar{photos.length > 0 ? ` (${photos.length} ta rasm bilan)` : ''} {userCount.toLocaleString('uz-UZ')} foydalanuvchiga yuboriladi. Davom etilsinmi?
              </p>
              <button
                type="button"
                className={s.confirmSend}
                disabled={send.isPending}
                onClick={() => send.mutate()}
              >
                {send.isPending ? 'Yuborilmoqda…' : 'Ha, yuborish'}
              </button>
              <button type="button" className={sheet.sheetClose} onClick={() => setConfirm(false)}>
                Bekor qilish
              </button>
            </div>
          </div>
        )}
      </div>
    </Page>
  );
};
