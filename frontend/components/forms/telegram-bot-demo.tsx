"use client";

import { useMutation } from "@tanstack/react-query";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { clientRequest } from "@/lib/client-api";
import type { Envelope, TelegramBotMenuButton, TelegramBotResult } from "@/types/api";

type ChatMessage = {
  id: number;
  role: "bot" | "user";
  text: string;
  buttons?: TelegramBotMenuButton[][];
  meta?: string;
};

const TELEGRAM_CHAT_ID = 910001;
const TELEGRAM_USER_ID = 440001;

export function TelegramBotDemo() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [counter, setCounter] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) =>
      clientRequest<Envelope<TelegramBotResult>>("/messaging/telegram/bot/webhook", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: (response) => {
      const reply = response.data.reply;
      setMessages((current) => [
        ...current,
        {
          id: Date.now(),
          role: "bot",
          text: reply.text,
          buttons: reply.buttons,
          meta:
            reply.lead_id || reply.estimated_total
              ? [
                  reply.lead_id ? `Lead: ${reply.lead_id}` : null,
                  reply.estimated_total ? `Оценка: ${reply.estimated_total}` : null,
                ]
                  .filter(Boolean)
                  .join(" | ")
              : undefined,
        },
      ]);
      setError(null);
    },
    onError: (mutationError: Error) => {
      setError(mutationError.message);
    },
  });

  function sendText(messageText: string) {
    const nextCounter = counter + 1;
    setCounter(nextCounter);
    setMessages((current) => [
      ...current,
      {
        id: Date.now(),
        role: "user",
        text: messageText,
      },
    ]);
    mutation.mutate({
      update_id: nextCounter,
      message: {
        message_id: nextCounter,
        text: messageText,
        chat: { id: TELEGRAM_CHAT_ID, type: "private" },
        from: { id: TELEGRAM_USER_ID, first_name: "Demo", last_name: "User" },
      },
    });
  }

  function sendCallback(callbackData: string) {
    const nextCounter = counter + 1;
    setCounter(nextCounter);
    setMessages((current) => [
      ...current,
      {
        id: Date.now(),
        role: "user",
        text: `[нажатие] ${callbackData}`,
      },
    ]);
    mutation.mutate({
      update_id: nextCounter,
      callback_query: {
        id: `cb-${nextCounter}`,
        data: callbackData,
        from: { id: TELEGRAM_USER_ID, first_name: "Demo", last_name: "User" },
        message: { message_id: nextCounter, chat: { id: TELEGRAM_CHAT_ID, type: "private" } },
      },
    });
  }

  return (
    <Card className="space-y-5">
      <div className="space-y-2">
        <Badge className="bg-amber-400 text-slate-900">Демо Telegram-бота</Badge>
        <h2 className="text-xl font-semibold text-slate-900">Как будет работать приём заявок из Telegram</h2>
        <p className="text-sm leading-6 text-slate-700">
          Это симулятор webhook-диалога. Бот ведёт клиента по меню, собирает размеры, считает
          ориентировочную сумму и создаёт lead в CRM.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="space-y-3">
          {messages.length === 0 ? (
            <p className="text-sm text-slate-500">
              Нажми старт и пройди примерный сценарий: изделие, размеры, материал, имя, телефон и
              затем lead в CRM.
            </p>
          ) : null}
          {messages.map((message) => (
            <div
              key={message.id}
              className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-6 ${
                message.role === "bot"
                  ? "bg-slate-50 text-slate-900"
                  : "ml-auto bg-amber-400 text-slate-900"
              }`}
            >
              <p>{message.text}</p>
              {message.meta ? <p className="mt-2 text-xs text-slate-500">{message.meta}</p> : null}
              {message.buttons?.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {message.buttons.flat().map((button, index) => (
                    <Button
                      key={`${button.callback_data}-${index}`}
                      variant="outline"
                      size="sm"
                      onClick={() => button.callback_data && sendCallback(button.callback_data)}
                    >
                      {button.text}
                    </Button>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="flex flex-wrap gap-3">
        <Button variant="secondary" onClick={() => sendText("/start")} disabled={mutation.isPending}>
          Старт бота
        </Button>
        <Button variant="ghost" onClick={() => sendText("/cancel")} disabled={mutation.isPending}>
          Сбросить сценарий
        </Button>
      </div>

      <div className="flex gap-3">
        <Input
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Или отправь сообщение как клиент: например 1200, Иван Петров или +79990001122"
        />
        <Button
          onClick={() => {
            const messageText = text.trim();
            if (!messageText) {
              return;
            }
            sendText(messageText);
            setText("");
          }}
          disabled={mutation.isPending}
        >
          Отправить
        </Button>
      </div>
    </Card>
  );
}
