import { type FC } from 'react';

import s from './Lightbox.module.css';

/** Full-screen image viewer — tap anywhere to close. */
export const Lightbox: FC<{ src: string; onClose: () => void }> = ({ src, onClose }) => (
  <div className={s.backdrop} onClick={onClose}>
    <img className={s.img} src={src} alt="" />
  </div>
);
