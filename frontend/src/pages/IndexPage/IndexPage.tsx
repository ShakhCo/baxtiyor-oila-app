import { type FC } from 'react';

import { Page } from '@/components/Page.tsx';

import s from './IndexPage.module.css';

type Step = { n: string; title: string; desc: string };
const STEPS: Step[] = [
  { n: '01', title: 'Anketa', desc: 'O‘zingiz va niyatingiz haqida qisqacha.' },
  { n: '02', title: 'Tanishuv', desc: 'Mos nomzodlarni qo‘lda tanlab beramiz.' },
  { n: '03', title: 'Nikoh', desc: 'Tanishuv va nikohda yo‘nalish beramiz.' },
];

type Tier = { name: string; price: string; desc: string };
const TIERS: Tier[] = [
  { name: 'Bepul', price: '0 €', desc: 'Anketa va asosiy maslahat' },
  { name: 'Standart', price: '20 €', desc: 'Tanlangan nomzodlar' },
  { name: 'Premium', price: '50 €', desc: 'Yashirin tanishuv · to‘y boshqaruvi' },
];

export const IndexPage: FC = () => {
  return (
    <Page back={false}>
      <div className={s.root}>
        {/* welcome ------------------------------------------- */}
        <header className={s.hero}>
          <picture>
            <source srcSet="/logo.avif" type="image/avif" />
            <img className={s.logo} src="/logo.png" alt="" width={84} height={84} />
          </picture>
          <h1 className={s.brand}>
            Baxtiyor <span className={s.brandItalic}>Oila</span>
          </h1>
          <p className={s.tagline}>Halol va jiddiy juftlik tanlash xizmati</p>
        </header>

        {/* process ------------------------------------------- */}
        <section className={s.block}>
          <h2 className={s.sectionTitle}>Qanday ishlaydi</h2>
          <div className={s.steps}>
            {STEPS.map(step => (
              <div key={step.n} className={s.row}>
                <span className={s.num}>{step.n}</span>
                <div className={s.rowMain}>
                  <span className={s.rowName}>{step.title}</span>
                  <span className={s.rowDesc}>{step.desc}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* hadith -------------------------------------------- */}
        <section className={s.block}>
          <blockquote className={s.quote}>
            <span className={s.quoteMark} aria-hidden>“</span>
            <p className={s.quoteText}>
              Kim uylansa, dinining yarmini kamol toptirgan bo‘ladi.
            </p>
            <cite className={s.quoteCite}>Hadis · Bayhaqiy</cite>
          </blockquote>
        </section>

        {/* tariffs ------------------------------------------- */}
        <section className={s.block}>
          <h2 className={s.sectionTitle}>Tariflar</h2>
          <div className={s.tiers}>
            {TIERS.map(tier => (
              <div key={tier.name} className={s.row}>
                <div className={s.rowMain}>
                  <span className={s.rowName}>{tier.name}</span>
                  <span className={s.rowDesc}>{tier.desc}</span>
                </div>
                <span className={s.price}>{tier.price}</span>
              </div>
            ))}
          </div>
        </section>

        <footer className={s.footer}>
          <span className={s.footerText}>„Humo“ o‘zbek-olmon hamjamiyati</span>
        </footer>
      </div>
    </Page>
  );
};
