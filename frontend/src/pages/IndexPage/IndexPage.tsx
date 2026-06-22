// import { openTelegramLink } from '@tma.js/sdk-react'; // used by the (hidden) contact section
import { useEffect, useRef, useState, type FC, type PropsWithChildren } from 'react';
import { useNavigate } from 'react-router-dom';

import { apiGet } from '@/api/client';
import { Page } from '@/components/Page.tsx';

import s from './IndexPage.module.css';

// const ADMIN_PRIMARY = 'BaxtiyorOila_admin';   // used by the (hidden) contact section
// const ADMIN_SECONDARY = 'Babaeva_L_S';

function ChatIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 4 H18 A2 2 0 0 1 20 6 V14 A2 2 0 0 1 18 16 H10 L6 20 V6 A2 2 0 0 1 6 4 Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function AnketaIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="5" y="3" width="14" height="18" rx="2.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M9 8 H15 M9 12 H15 M9 16 H13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function Arrow() {
  return (
    <svg width="17" height="17" viewBox="0 0 18 18" aria-hidden>
      <path
        d="M3 9 H14 M10 5 L14 9 L10 13"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

/** When (ms after load) scroll reveals may begin — held until the hero
 *  opening animation has finished so sections never reveal before the header. */
const INTRO_MS = 1850;

/** The logo zoom plays once per real page load. This module-level flag
 *  survives in-app navigation (component remounts) but resets on a full
 *  reload, so coming back from another page skips the opening animation. */
let heroIntroPlayed = false;

/** Section that fades + slides into view — never before the hero opening is
 *  done, and staggered by `index` so the sections cascade top-to-bottom. */
function RevealSection({ index = 0, children }: PropsWithChildren<{ index?: number }>) {
  const ref = useRef<HTMLElement | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduceMotion =
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    if (reduceMotion || typeof IntersectionObserver === 'undefined') {
      setShown(true);
      return;
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        // performance.now() is ms since page load; hold reveals until INTRO_MS.
        const wait = Math.max(0, INTRO_MS - performance.now());
        timer = setTimeout(() => setShown(true), wait);
      },
      { threshold: 0.12, rootMargin: '0px 0px -12% 0px' },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      if (timer) clearTimeout(timer);
    };
  }, []);

  return (
    <section
      ref={ref}
      className={`${s.block} ${s.reveal}${shown ? ` ${s.shown}` : ''}`}
      style={{ transitionDelay: `${index * 110}ms` }}
    >
      {children}
    </section>
  );
}

type Step = { n: string; title: string; desc: string };
const STEPS: Step[] = [
  { n: '01', title: 'Anketa', desc: 'O‘zingiz va niyatingiz haqida qisqacha.' },
  { n: '02', title: 'Tanishuv', desc: 'Mos nomzodlarni qo‘lda tanlab beramiz.' },
  { n: '03', title: 'Nikoh', desc: 'Tanishuv va nikohda yo‘nalish beramiz.' },
];

type Tier = { name: string; price: string; desc: string; featured?: boolean };
const TIERS: Tier[] = [
  { name: 'Bepul', price: '0 €', desc: 'Anketa va asosiy maslahat' },
  { name: 'Standart', price: '20 €', desc: 'Tanlangan nomzodlar' },
  { name: 'Premium', price: '50 €', desc: 'Yashirin tanishuv · to‘y boshqaruvi', featured: true },
];

/* contact list — hidden for now, restore with the contact section below
const CONTACTS = [
  { name: 'Admin', handle: ADMIN_PRIMARY },
  { name: 'Lobar opa', handle: ADMIN_SECONDARY },
];
*/

export const IndexPage: FC = () => {
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  // True only on the first mount after a real page load.
  const [playIntro] = useState(() => !heroIntroPlayed);

  useEffect(() => {
    // Flip only after the opening has run. This keeps the flag false during
    // React StrictMode's immediate dev remount (so the first load still
    // animates), while a real later navigation back sees it already played.
    // No cleanup on unmount, so navigating away mid-intro still marks it done.
    if (!playIntro) return;
    setTimeout(() => { heroIntroPlayed = true; }, 2400);
  }, [playIntro]);

  useEffect(() => {
    apiGet<{ is_admin: boolean }>('/me')
      .then(data => setIsAdmin(Boolean(data.is_admin)))
      .catch(() => { /* not admin or auth issue — landing still renders fine */ });
  }, []);

  return (
    <Page back={false}>
      <div className={playIntro ? `${s.root} ${s.animateIntro}` : s.root}>
        <div className={s.vignette} aria-hidden />
        <div className={s.fadeTop} aria-hidden />
        <div className={s.fadeBottom} aria-hidden />

        {/* hero ------------------------------------------------ */}
        <header className={s.hero}>
          <div className={s.logoWrap}>
            <img
              className={s.logo}
              src="/logo.png"
              alt=""
              width={104}
              height={104}
            />
          </div>
          <h1 className={s.brand}>
            <span>Baxtiyor</span> <span className={s.brandItalic}>Oila</span>
          </h1>
          <p className={s.tagline}>Halol va jiddiy juftlik tanlash xizmati</p>

          <button type="button" className={s.cta} onClick={() => navigate('/anketa')}>
            <span>Anketa to‘ldirish</span>
            <span className={s.ctaArrow}><Arrow /></span>
          </button>
          <p className={s.ctaHint}>Bepul · 3–5 daqiqa</p>
        </header>

        {/* process -------------------------------------------- */}
        <RevealSection index={0}>
          <p className={s.eyebrow}>Jarayon</p>
          <h2 className={s.blockTitle}>Uch qadam</h2>
          <ol className={s.card}>
            {STEPS.map(step => (
              <li key={step.n} className={s.row}>
                <span className={s.num}>{step.n}</span>
                <div className={s.rowMain}>
                  <span className={s.rowName}>{step.title}</span>
                  <span className={s.rowDesc}>{step.desc}</span>
                </div>
              </li>
            ))}
          </ol>
        </RevealSection>

        {/* hadith --------------------------------------------- */}
        <RevealSection index={1}>
          <blockquote className={s.quote}>
            <span className={s.quoteMark} aria-hidden>“</span>
            <p className={s.quoteText}>
              Kim uylansa, dinining yarmini kamol toptirgan bo‘ladi.
            </p>
            <cite className={s.quoteCite}>Hadis · Bayhaqiy</cite>
          </blockquote>
        </RevealSection>

        {/* tariffs -------------------------------------------- */}
        <RevealSection index={2}>
          <p className={s.eyebrow}>Tariflar</p>
          <h2 className={s.blockTitle}>Shaffof narxlar</h2>
          <ul className={s.card}>
            {TIERS.map(tier => (
              <li key={tier.name} className={tier.featured ? `${s.row} ${s.rowFeatured}` : s.row}>
                <div className={s.rowMain}>
                  <span className={s.rowName}>{tier.name}</span>
                  <span className={s.rowDesc}>{tier.desc}</span>
                </div>
                <span className={s.price}>{tier.price}</span>
              </li>
            ))}
          </ul>
        </RevealSection>

        {/* contact section hidden for now — chat now lives in the bottom nav; restore when needed:
        <RevealSection index={3}>
          <p className={s.eyebrow}>Aloqa</p>
          <h2 className={s.blockTitle}>Bog‘lanish</h2>
          <ul className={s.card}>
            <li className={s.row}>
              <button type="button" className={s.contact} onClick={() => navigate('/chat')}>
                <div className={s.rowMain}>
                  <span className={s.rowName}>Onlayn suhbat</span>
                  <span className={s.rowDesc}>Ilova ichida admin bilan yozishing</span>
                </div>
                <span className={s.contactArrow}><Arrow /></span>
              </button>
            </li>
            {CONTACTS.map(c => (
              <li key={c.handle} className={s.row}>
                <button
                  type="button"
                  className={s.contact}
                  onClick={() => openTelegramLink(`https://t.me/${c.handle}`)}
                >
                  <div className={s.rowMain}>
                    <span className={s.rowName}>{c.name}</span>
                    <span className={s.rowDesc}>@{c.handle}</span>
                  </div>
                  <span className={s.contactArrow}><Arrow /></span>
                </button>
              </li>
            ))}
          </ul>
        </RevealSection>
        */}

        <footer className={s.footer}>
          <span className={s.footerText}>„Humo“ o‘zbek-olmon hamjamiyati</span>
        </footer>

        {isAdmin && (
          <button
            type="button"
            className={s.anketaFab}
            onClick={() => navigate('/admin')}
            aria-label="Anketalar paneli"
          >
            <AnketaIcon />
          </button>
        )}

        <button
          type="button"
          className={s.chatFab}
          onClick={() => navigate(isAdmin ? '/admin/chat' : '/chat')}
          aria-label="Suhbat"
        >
          <ChatIcon />
        </button>
      </div>
    </Page>
  );
};
