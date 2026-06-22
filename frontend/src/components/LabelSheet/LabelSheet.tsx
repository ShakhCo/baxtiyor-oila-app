import { useState, type FC } from 'react';

import { apiPost } from '@/api/client';
import s from '@/pages/ChatPage/ChatPage.module.css';

type Props = {
  /** Whose conversation we're labelling. */
  telegramId: number | string;
  /** Currently assigned labels. */
  initial: string[];
  /** All global labels to choose from. */
  allLabels: string[];
  onClose: () => void;
  /** Called with the new label set (optimistically, then again with the server's). */
  onSaved: (labels: string[]) => void;
};

// Bottom-sheet label picker: tap a label to toggle it on/off for this user. No
// free-text creation here — new labels are created from the chat list's "+".
export const LabelSheet: FC<Props> = ({ telegramId, initial, allLabels, onClose, onSaved }) => {
  const [labels, setLabels] = useState<string[]>(initial);

  function save(next: string[]) {
    const clean = Array.from(new Set(next)).slice(0, 8);
    setLabels(clean);
    onSaved(clean); // optimistic — keep the list in sync immediately
    apiPost<{ labels: string[] }>(`/admin/chats/${telegramId}/labels`, { labels: clean })
      .then(res => { setLabels(res.labels); onSaved(res.labels); })
      .catch(() => { /* keep optimistic value */ });
  }

  return (
    // close on pointerdown (not click): when opened from a long-press, the
    // trailing synthetic click would otherwise land here and dismiss instantly.
    <div className={s.sheetBackdrop} onPointerDown={onClose}>
      <div className={s.sheet} onPointerDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
        <h2 className={s.sheetTitle}>Belgilar</h2>

        {allLabels.length === 0 ? (
          <p className={s.sheetHint}>
            Hozircha belgilar yo‘q. Ularni ro‘yxat yuqorisidagi “+” tugmasi orqali qo‘shing.
          </p>
        ) : (
          <div className={s.chipRow}>
            {allLabels.map(l => {
              const on = labels.includes(l);
              return (
                <button
                  key={l}
                  type="button"
                  className={on ? s.chip : s.preset}
                  onClick={() => save(on ? labels.filter(x => x !== l) : [...labels, l])}
                >
                  {on ? <>{l}<span className={s.chipX}>×</span></> : `+ ${l}`}
                </button>
              );
            })}
          </div>
        )}

        <button type="button" className={s.sheetClose} onClick={onClose}>
          Yopish
        </button>
      </div>
    </div>
  );
};
