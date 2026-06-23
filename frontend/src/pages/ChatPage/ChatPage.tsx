import { type FC } from 'react';

import { Page } from '@/components/Page.tsx';
import { ChatThread } from '@/components/ChatThread/ChatThread';

import s from './ChatPage.module.css';

export const ChatPage: FC = () => {
  return (
    <Page back>
      <div className={`${s.root} ${s.light}`}>
        <header className={s.header}>
          <span className={s.name}>Baxtiyor Oila</span>
          <span className={s.status}>
            <span className={s.dot} aria-hidden />
            Hozirda online
          </span>
        </header>
        <ChatThread basePath="/chat" mySide="user" theme="light" />
      </div>
    </Page>
  );
};
