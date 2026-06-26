import { useEffect, useRef, useState, type FC } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiGet, apiPost } from '@/api/client';

import s from './ChatThread.module.css';

/** Poll cadence while a thread is open — fast enough to feel real-time. The
 *  cache keeps the existing messages between polls, so refetches never flash the
 *  skeleton (that only shows on the very first, data-less load). */
const CHAT_POLL_MS = 3_000;

type ChatPayload = { messages?: ChatMessage[] } & Record<string, unknown>;

export type ChatMessage = {
  id: number;
  sender: 'user' | 'admin';
  text: string;
  created_at: string;
  delivery_failed?: boolean;
  /** True once the other party has read this message (drives the ✓✓ receipt). */
  read?: boolean;
};

type Props = {
  /** API path that serves GET ?after=<id> (messages) and POST {text} (send). */
  basePath: string;
  /** Which side counts as "me" (right-aligned bubbles). */
  mySide: 'user' | 'admin';
  emptyHint?: string;
  /** Called with the raw GET payload on each poll (e.g. to read `user` meta). */
  onMeta?: (raw: unknown) => void;
  /** Called right after a message is sent, so the parent can update the inbox. */
  onSent?: (msg: ChatMessage) => void;
  /** Colour theme. Admin thread stays dark; the user chat is light. */
  theme?: 'light' | 'dark';
  /** Add device safe-area padding under the composer. Off when a bottom nav sits below it. */
  bottomSafe?: boolean;
};

const SKELETON: { mine: boolean; w: string; h: number }[] = [
  { mine: false, w: '58%', h: 40 },
  { mine: true,  w: '44%', h: 36 },
  { mine: false, w: '72%', h: 56 },
  { mine: true,  w: '50%', h: 36 },
  { mine: false, w: '40%', h: 36 },
  { mine: true,  w: '64%', h: 50 },
];

function timeLabel(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' });
}

function ArrowUp() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden>
      <path d="M10 16 V5 M5 9 L10 4 L15 9" stroke="currentColor" strokeWidth="1.8"
        strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

/** Read receipt: one tick = sent, two ticks = read by the other party. */
function Ticks({ read }: { read: boolean }) {
  return (
    <svg width="18" height="11" viewBox="0 0 18 11" fill="none" aria-hidden>
      <path d="M1 6 L4 9 L9.5 2.5" stroke="currentColor" strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round" />
      {read && (
        <path d="M7.5 9 L13 2.5" stroke="currentColor" strokeWidth="1.5"
          strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  );
}

export const ChatThread: FC<Props> = ({ basePath, mySide, emptyHint, onMeta, onSent, theme = 'dark', bottomSafe = true }) => {
  const queryClient = useQueryClient();
  const queryKey = ['chat', basePath] as const;
  const [text, setText] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputBarRef = useRef<HTMLDivElement>(null);
  const onMetaRef = useRef(onMeta);
  onMetaRef.current = onMeta;
  const onSentRef = useRef(onSent);
  onSentRef.current = onSent;

  // Cached thread fetch. The full list comes back each poll; within the stale
  // window (30s) returning to a thread shows the cached messages with no refetch.
  const { data, isSuccess } = useQuery({
    queryKey,
    queryFn: () => apiGet<ChatPayload>(basePath),
    staleTime: CHAT_POLL_MS,
    refetchInterval: CHAT_POLL_MS,
  });
  const messages = data?.messages ?? [];
  const loaded = isSuccess;

  // surface the raw payload (user meta, labels) to the parent on each update
  useEffect(() => { if (data) onMetaRef.current?.(data); }, [data]);

  // grow the composer to fit its content (capped), shrink back when cleared
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 132)}px`;
  }, [text]);

  // the composer is a glassy overlay — keep the scroll's bottom padding equal to
  // its height so messages never sit hidden under it (but can scroll behind it)
  useEffect(() => {
    const bar = inputBarRef.current;
    const scroll = scrollRef.current;
    if (!bar || !scroll || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      scroll.style.paddingBottom = `${bar.offsetHeight + 8}px`;
    });
    ro.observe(bar);
    return () => ro.disconnect();
  }, []);

  // keep pinned to the latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // send appends the new message straight into the cache so it shows instantly,
  // without waiting for the next poll
  const sendMutation = useMutation({
    mutationFn: (body: string) => apiPost<ChatMessage>(basePath, { text: body }),
    onSuccess: (msg) => {
      queryClient.setQueryData<ChatPayload>(queryKey, (prev) => {
        const list = prev?.messages ?? [];
        if (list.some(m => m.id === msg.id)) return prev;
        return { ...(prev ?? {}), messages: [...list, msg] };
      });
      onSentRef.current?.(msg); // let the parent refresh the inbox preview
      setText('');
      inputRef.current?.focus(); // keep typing — don't drop the keyboard
      requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }));
    },
    // on error keep the text so the user can retry
  });
  const sending = sendMutation.isPending;

  function send() {
    const body = text.trim();
    if (!body || sending) return;
    sendMutation.mutate(body);
  }

  return (
    <div className={theme === 'light' ? `${s.thread} ${s.threadLight}` : s.thread}>
      <div className={mySide === 'admin' ? `${s.scroll} ${s.scrollAdmin}` : s.scroll} ref={scrollRef}>
        {!loaded && SKELETON.map((b, i) => (
          <div key={i} className={`${s.row} ${b.mine ? s.mine : s.theirs}`} aria-hidden>
            <span className={s.skelBubble} style={{ width: b.w, height: b.h }} />
          </div>
        ))}
        {loaded && messages.length === 0 && emptyHint && (
          <p className={s.empty}>{emptyHint}</p>
        )}
        {messages.map(m => {
          const failed = m.delivery_failed && m.sender === mySide;
          return (
            <div key={m.id} className={`${s.row} ${m.sender === mySide ? s.mine : s.theirs}`}>
              <div className={s.bubble}>
                <span className={s.text}>{m.text}</span>
                <span className={s.metaRow}>
                  {failed && <span className={s.failed}>⚠ Yetkazilmadi</span>}
                  <span className={s.time}>{timeLabel(m.created_at)}</span>
                  {m.sender === mySide && !failed && (
                    <span className={m.read ? `${s.tick} ${s.tickRead}` : s.tick}>
                      <Ticks read={!!m.read} />
                    </span>
                  )}
                </span>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className={s.inputBar} ref={inputBarRef} style={bottomSafe ? undefined : { paddingBottom: 12 }}>
        <textarea
          ref={inputRef}
          className={s.input}
          value={text}
          onChange={e => setText(e.target.value)}
          onFocus={() => {
            // wait for the keyboard to animate up, then pin to the latest message
            setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 300);
          }}
          placeholder="Xabar yozing…"
          rows={1}
        />
        <button
          type="button"
          className={sending ? `${s.send} ${s.sending}` : s.send}
          onPointerDown={e => e.preventDefault()} // keep focus on the textarea
          onClick={send}
          disabled={!text.trim() || sending}
          aria-label="Yuborish"
        >
          {sending ? <span className={s.spinner} aria-hidden /> : <ArrowUp />}
        </button>
      </div>
    </div>
  );
};
