"use client";

import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import {
  ArrowUp,
  CalendarCheck,
  CalendarPlus,
  ChevronDown,
  Clock,
  MessageCircle,
  RotateCcw,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import ReactMarkdown from "react-markdown";
import type { ChatEvent } from "@/app/api/chat/route";
import { OPEN_CHAT_EVENT } from "@/components/site/open-chat-button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import type { BookingConfirmation, SlotSuggestions } from "@/lib/concierge";
import { cn } from "@/lib/utils";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  /** Epoch milliseconds; absent on the built-in greeting. */
  time?: number;
  booking?: BookingConfirmation | null;
  slots?: SlotSuggestions | null;
  /** Local notices (the greeting, errors) are shown but never sent back to the model. */
  local?: boolean;
  error?: boolean;
};

const STORAGE_KEY = "vellura-chat-v1";

const GREETING: Message = {
  id: "greeting",
  role: "assistant",
  content:
    "Welcome to Vellura Dental. I am your concierge, and it would be my pleasure to arrange your visit. Which treatment may I reserve for you?",
  local: true,
};

const SUGGESTIONS = [
  "Book a Signature Cleaning",
  "Laser Whitening this week",
  "Veneer Consultation times",
  "What are your opening hours?",
];

const ease = [0.22, 1, 0.36, 1] as const;

function formatTime(time: number) {
  return new Date(time).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function loadStored(): Message[] | null {
  try {
    const stored = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "null");
    return Array.isArray(stored) && stored.length ? (stored as Message[]) : null;
  } catch {
    return null;
  }
}

/**
 * The model only receives text, so a confirmed booking is spelled out in the history.
 * Without this it cannot tell that the appointment already exists and may try to book it twice.
 */
function toApiMessage({ role, content, booking }: Message) {
  if (!booking) return { role, content };
  const note = `[Booking system: appointment CONFIRMED and saved. Reference ${booking.id.slice(-6).toUpperCase()}: ${booking.serviceName} for ${booking.patientName} on ${booking.dateLabel} at ${booking.timeLabel}. Do not book it again.]`;
  return { role, content: `${content}\n\n${note}` };
}

/** Builds an .ics calendar file for the booked appointment and downloads it. */
function downloadCalendarFile(booking: BookingConfirmation) {
  const stamp = (iso: string) => iso.replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Vellura Dental//Concierge//EN",
    "BEGIN:VEVENT",
    `UID:${booking.id}@velluradental`,
    `DTSTAMP:${stamp(new Date().toISOString())}`,
    `DTSTART:${stamp(booking.startISO)}`,
    `DTEND:${stamp(booking.endISO)}`,
    `SUMMARY:${booking.serviceName} at Vellura Dental`,
    `DESCRIPTION:Appointment for ${booking.patientName}. Reference ${booking.id.slice(-6).toUpperCase()}.`,
    "LOCATION:Vellura Dental",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "vellura-dental-appointment.ics";
  link.click();
  URL.revokeObjectURL(url);
}

function BookingCard({ booking }: { booking: BookingConfirmation }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease, delay: 0.15 }}
      className="mt-3 overflow-hidden rounded-2xl border border-sky-200 bg-white shadow-soft"
    >
      <div className="flex items-center gap-2 bg-linear-to-r from-vellura-cyan to-vellura-deep px-4 py-2.5 text-white">
        <CalendarCheck className="size-4" aria-hidden />
        <p className="text-[0.65rem] font-semibold tracking-[0.2em] uppercase">Appointment confirmed</p>
      </div>
      <div className="px-4 py-3.5">
        <p className="text-sm font-semibold text-vellura-ink">{booking.serviceName}</p>
        <p className="mt-1.5 flex items-center gap-2 text-xs tracking-wide text-muted-foreground">
          <Clock className="size-3.5 text-vellura-cyan" aria-hidden />
          {booking.dateLabel} · {booking.timeLabel} · {booking.durationMin} min
        </p>
        <dl className="mt-3 grid grid-cols-2 gap-3 border-t border-border pt-3 text-xs tracking-wide">
          <div>
            <dt className="text-[0.6rem] font-semibold tracking-[0.18em] text-muted-foreground uppercase">Guest</dt>
            <dd className="mt-0.5 text-vellura-ink">{booking.patientName}</dd>
          </div>
          <div>
            <dt className="text-[0.6rem] font-semibold tracking-[0.18em] text-muted-foreground uppercase">Reference</dt>
            <dd className="mt-0.5 font-medium text-vellura-ink tabular-nums">{booking.id.slice(-6).toUpperCase()}</dd>
          </div>
        </dl>
        <Button
          variant="outline"
          size="sm"
          className="mt-3.5 h-9 w-full rounded-full border-sky-200 text-xs tracking-wide text-vellura-cyan hover:bg-sky-50 hover:text-vellura-deep"
          onClick={() => downloadCalendarFile(booking)}
        >
          <CalendarPlus aria-hidden />
          Add to calendar
        </Button>
      </div>
    </motion.div>
  );
}

function SlotPicker({ slots, onPick, disabled }: { slots: SlotSuggestions; onPick: (text: string) => void; disabled: boolean }) {
  const groups = [
    { label: "Morning", times: slots.times.filter((slot) => slot.value < "12:00") },
    { label: "Afternoon", times: slots.times.filter((slot) => slot.value >= "12:00") },
  ].filter((group) => group.times.length > 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease, delay: 0.1 }}
      className="ml-10 rounded-2xl border border-border bg-white p-3.5 shadow-soft"
    >
      <p className="text-xs font-semibold tracking-wide text-vellura-ink">{slots.dateLabel}</p>
      <p className="text-[0.7rem] tracking-wide text-muted-foreground">{slots.serviceName} · tap a time to choose it</p>
      {groups.map((group) => (
        <div key={group.label} role="group" aria-label={`${group.label} times`} className="mt-3">
          <p className="text-[0.6rem] font-semibold tracking-[0.18em] text-muted-foreground uppercase">{group.label}</p>
          <div className="mt-1.5 grid grid-cols-3 gap-1.5 min-[400px]:grid-cols-4">
            {group.times.map((slot) => (
              <button
                key={slot.value}
                type="button"
                disabled={disabled}
                onClick={() => onPick(`${slot.label} on ${slots.dateLabel}, please`)}
                className="h-9 rounded-xl border border-sky-200 bg-sky-50/60 text-xs font-medium tracking-wide text-vellura-deep tabular-nums transition-all outline-none hover:border-vellura-cyan hover:bg-vellura-cyan hover:text-white focus-visible:ring-2 focus-visible:ring-ring active:scale-95 disabled:pointer-events-none disabled:opacity-50"
              >
                {slot.label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </motion.div>
  );
}

function ConciergeAvatar({ className }: { className?: string }) {
  return (
    <Avatar size="default" className={cn("after:hidden", className)}>
      <AvatarFallback className="bg-linear-to-br from-vellura-sky to-vellura-cyan text-white">
        <Sparkles className="size-3.5" aria-hidden />
      </AvatarFallback>
    </Avatar>
  );
}

function TypingIndicator({ label }: { label: string | null }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, transition: { duration: 0.15 } }}
      className="flex items-end gap-2"
      role="status"
    >
      <ConciergeAvatar />
      <div className="flex items-center gap-2.5 rounded-2xl rounded-bl-md bg-white px-4 py-3 shadow-soft ring-1 ring-border">
        <span className="flex items-center gap-1" aria-hidden>
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="size-1.5 rounded-full bg-vellura-sky"
              animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }}
              transition={{ duration: 1, repeat: Infinity, delay: i * 0.16 }}
            />
          ))}
        </span>
        <AnimatePresence mode="wait">
          {label && (
            <motion.span
              key={label}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              className="text-xs tracking-wide text-muted-foreground"
            >
              {label}
            </motion.span>
          )}
        </AnimatePresence>
        {!label && <span className="sr-only">The concierge is typing</span>}
      </div>
    </motion.div>
  );
}

function MessageBody({ content }: { content: string }) {
  return (
    <ReactMarkdown
      allowedElements={["p", "strong", "em", "ul", "ol", "li", "br"]}
      unwrapDisallowed
      components={{
        p: ({ children }) => <p className="[&:not(:first-child)]:mt-2">{children}</p>,
        strong: ({ children }) => <strong className="font-semibold text-vellura-deep">{children}</strong>,
        ul: ({ children }) => <ul className="mt-2 list-disc space-y-1 pl-4">{children}</ul>,
        ol: ({ children }) => <ol className="mt-2 list-decimal space-y-1 pl-4">{children}</ol>,
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([GREETING]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const restored = useRef(false);
  const counter = useRef(0);

  const newId = () => `${Date.now()}-${counter.current++}`;

  /** Restores this tab's conversation the first time the chat is opened. */
  const openChat = useCallback(() => {
    if (!restored.current) {
      restored.current = true;
      const stored = loadStored();
      if (stored) setMessages(stored);
    }
    setOpen(true);
  }, []);

  useEffect(() => {
    window.addEventListener(OPEN_CHAT_EVENT, openChat);
    return () => window.removeEventListener(OPEN_CHAT_EVENT, openChat);
  }, [openChat]);

  useEffect(() => {
    if (!restored.current) return;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch {
      // Storage may be unavailable (private mode); the chat still works for this page view.
    }
  }, [messages]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);

    // On phones the chat is full-screen, so stop the page behind it from scrolling.
    const fullScreen = window.matchMedia("(max-width: 639px)").matches;
    if (fullScreen) document.body.style.overflow = "hidden";
    else inputRef.current?.focus();

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, pending, status, open]);

  useEffect(() => {
    const field = inputRef.current;
    if (!field) return;
    field.style.height = "auto";
    field.style.height = `${Math.min(field.scrollHeight, 128)}px`;
  }, [input, open]);

  /** Sends `history` (ending in a user message) to the concierge and appends the reply. */
  async function requestReply(history: Message[]) {
    setPending(true);
    setStatus(null);

    const fail = (content: string) =>
      setMessages((current) => [
        ...current,
        { id: newId(), role: "assistant", content, time: Date.now(), local: true, error: true },
      ]);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history.filter((m) => !m.local).map(toApiMessage),
        }),
      });

      if (!response.ok || !response.body) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        fail(data.error ?? "Something went wrong. Please try again.");
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let answered = false;

      const handle = (line: string) => {
        if (!line.trim()) return;
        const event = JSON.parse(line) as ChatEvent;
        if (event.type === "status") {
          setStatus(event.label);
        } else if (event.type === "reply") {
          answered = true;
          setMessages((current) => [
            ...current,
            { id: newId(), role: "assistant", content: event.reply, time: Date.now(), booking: event.booking, slots: event.slots },
          ]);
        } else {
          answered = true;
          fail(event.error);
        }
      };

      for (;;) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        lines.forEach(handle);
        if (done) break;
      }
      handle(buffer);
      if (!answered) fail("The connection was interrupted. Please try again.");
    } catch {
      fail("I could not reach the clinic just now. Please check your connection and try again.");
    } finally {
      setPending(false);
      setStatus(null);
    }
  }

  function send(text: string) {
    const content = text.trim();
    if (!content || pending) return;
    const history: Message[] = [...messages, { id: newId(), role: "user", content, time: Date.now() }];
    setMessages(history);
    setInput("");
    void requestReply(history);
  }

  function retry() {
    if (pending) return;
    const history = messages.filter((m) => !m.error);
    if (history[history.length - 1]?.role !== "user") return;
    setMessages(history);
    void requestReply(history);
  }

  function reset() {
    if (pending) return;
    setMessages([GREETING]);
    setInput("");
    inputRef.current?.focus();
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    send(input);
  }

  function onInputKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      send(input);
    }
  }

  const hasConversation = messages.length > 1;

  return (
    <MotionConfig reducedMotion="user">
      <AnimatePresence>
        {open && (
          <motion.section
            key="panel"
            role="dialog"
            aria-label="Vellura Dental concierge"
            initial={{ opacity: 0, y: 28, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.98 }}
            transition={{ duration: 0.35, ease }}
            className="fixed inset-0 z-50 flex origin-bottom-right flex-col overflow-hidden bg-white sm:inset-auto sm:right-6 sm:bottom-24 sm:h-[min(42rem,calc(100dvh-8rem))] sm:w-[26rem] sm:rounded-3xl sm:border sm:border-border sm:shadow-float"
          >
            <header className="relative flex items-center gap-3 bg-linear-to-br from-vellura-cyan to-vellura-deep px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-4 text-white sm:px-5">
              <div className="relative">
                <Avatar size="lg" className="after:hidden">
                  <AvatarFallback className="bg-white/15 text-white ring-1 ring-white/30 backdrop-blur">
                    <Sparkles className="size-4.5" aria-hidden />
                  </AvatarFallback>
                </Avatar>
                <span className="absolute right-0 bottom-0 size-2.5 rounded-full bg-emerald-400 ring-2 ring-vellura-cyan" aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold tracking-[0.16em] uppercase">Vellura Concierge</p>
                <p className="text-xs tracking-wide text-white/80">Online · replies in moments</p>
              </div>
              {hasConversation && (
                <Button
                  variant="ghost"
                  size="icon-lg"
                  className="rounded-full text-white/85 hover:bg-white/15 hover:text-white"
                  onClick={reset}
                  disabled={pending}
                  aria-label="Start a new conversation"
                  title="Start a new conversation"
                >
                  <RotateCcw />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon-lg"
                className="rounded-full text-white/85 hover:bg-white/15 hover:text-white"
                onClick={() => setOpen(false)}
                aria-label="Close chat"
              >
                <ChevronDown className="size-5" />
              </Button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-vellura-mist">
              <div className="flex flex-col gap-3 px-4 py-5 sm:px-5" aria-live="polite">
                <p className="mx-auto rounded-full bg-white px-3 py-1 text-[0.65rem] font-medium tracking-[0.16em] text-muted-foreground uppercase ring-1 ring-border">
                  Today
                </p>

                {messages.map((message, index) => {
                  const mine = message.role === "user";
                  const isLast = index === messages.length - 1;
                  return (
                    <div key={message.id} className="flex flex-col gap-2">
                      <motion.div
                        initial={{ opacity: 0, x: mine ? 20 : -20, y: 8 }}
                        animate={{ opacity: 1, x: 0, y: 0 }}
                        transition={{ duration: 0.4, ease }}
                        className={cn("flex items-end gap-2", mine && "flex-row-reverse")}
                      >
                        {!mine && <ConciergeAvatar />}
                        <div className={cn("flex max-w-[82%] flex-col", mine ? "items-end" : "items-start")}>
                          <div
                            className={cn(
                              "rounded-2xl px-4 py-2.5 text-[0.9rem] leading-relaxed tracking-wide break-words",
                              mine
                                ? "rounded-br-md bg-linear-to-br from-vellura-cyan to-vellura-deep whitespace-pre-wrap text-white shadow-soft"
                                : "rounded-bl-md bg-white text-vellura-ink shadow-soft ring-1 ring-border",
                              message.error && "bg-rose-50 text-rose-800 ring-rose-200",
                            )}
                          >
                            {mine ? message.content : <MessageBody content={message.content} />}
                            {message.booking && <BookingCard booking={message.booking} />}
                          </div>
                          <div className="mt-1 flex items-center gap-3 px-1">
                            {message.time && (
                              <time className="text-[0.65rem] tracking-wide text-muted-foreground" dateTime={new Date(message.time).toISOString()}>
                                {formatTime(message.time)}
                              </time>
                            )}
                            {message.error && isLast && (
                              <button
                                type="button"
                                onClick={retry}
                                className="flex items-center gap-1 text-[0.7rem] font-semibold tracking-wide text-vellura-cyan underline-offset-4 outline-none hover:underline focus-visible:underline"
                              >
                                <RefreshCw className="size-3" aria-hidden />
                                Try again
                              </button>
                            )}
                          </div>
                        </div>
                      </motion.div>

                      {message.slots && isLast && !pending && (
                        <SlotPicker slots={message.slots} onPick={send} disabled={pending} />
                      )}
                    </div>
                  );
                })}

                <AnimatePresence>{pending && <TypingIndicator label={status} />}</AnimatePresence>

                {!hasConversation && !pending && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.25, duration: 0.4, ease }}
                    className="mt-1 ml-10 flex flex-wrap gap-2"
                  >
                    {SUGGESTIONS.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => send(suggestion)}
                        className="rounded-full border border-sky-200 bg-white px-3.5 py-2 text-xs font-medium tracking-wide text-vellura-cyan shadow-soft transition-all outline-none hover:border-vellura-cyan hover:bg-sky-50 hover:text-vellura-deep focus-visible:ring-2 focus-visible:ring-ring active:scale-95"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </motion.div>
                )}
                <div ref={endRef} className="h-px" />
              </div>
            </div>

            <form
              onSubmit={onSubmit}
              className="border-t border-border bg-white px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-4"
            >
              <div className="flex items-end gap-2 rounded-3xl border border-input bg-vellura-mist py-1.5 pr-1.5 pl-4 transition-shadow focus-within:border-vellura-sky focus-within:ring-3 focus-within:ring-vellura-sky/25">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={onInputKeyDown}
                  rows={1}
                  placeholder="Write a message…"
                  aria-label="Message the concierge"
                  maxLength={2000}
                  enterKeyHint="send"
                  className="max-h-32 min-h-9 flex-1 resize-none self-center bg-transparent py-1.5 text-base tracking-wide text-vellura-ink outline-none placeholder:text-muted-foreground sm:text-sm"
                />
                <Button
                  type="submit"
                  size="icon-lg"
                  className="size-10 shrink-0 rounded-full shadow-soft hover:bg-vellura-deep"
                  disabled={pending || !input.trim()}
                  aria-label="Send message"
                >
                  <ArrowUp className="size-4.5" />
                </Button>
              </div>
              <p className="mt-2 hidden text-center text-[0.65rem] tracking-wide text-muted-foreground sm:block">
                Enter to send · Shift + Enter for a new line
              </p>
            </form>
          </motion.section>
        )}
      </AnimatePresence>

      <motion.button
        type="button"
        onClick={() => (open ? setOpen(false) : openChat())}
        aria-label={open ? "Close concierge chat" : "Open concierge chat"}
        aria-expanded={open}
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.9, duration: 0.5, ease }}
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.95 }}
        className={cn(
          "fixed right-4 bottom-[max(1.25rem,env(safe-area-inset-bottom))] z-50 flex h-14 items-center justify-center gap-2.5 rounded-full bg-linear-to-br from-vellura-cyan to-vellura-deep text-white shadow-float outline-none focus-visible:ring-4 focus-visible:ring-vellura-sky/50 sm:right-6 sm:bottom-6",
          open ? "w-14 max-sm:hidden" : "w-14 sm:w-auto sm:px-6",
        )}
      >
        {open ? (
          <ChevronDown className="size-6" aria-hidden />
        ) : (
          <>
            <MessageCircle className="size-6 sm:size-5" aria-hidden />
            <span className="hidden text-xs font-semibold tracking-[0.16em] uppercase sm:inline">Concierge</span>
          </>
        )}
      </motion.button>
    </MotionConfig>
  );
}
