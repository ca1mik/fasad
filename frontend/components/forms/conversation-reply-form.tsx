"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { clientRequest } from "@/lib/client-api";

type Props = {
  conversationId: string;
  /** True when the channel has a working transport, so the reply really leaves the CRM. */
  hasRealTransport?: boolean;
};

export function ConversationReplyForm({ conversationId, hasRealTransport = false }: Props) {
  const router = useRouter();
  const [bodyText, setBodyText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const reply = useMutation({
    mutationFn: async () =>
      clientRequest(`/messaging/conversations/${conversationId}/messages`, {
        method: "POST",
        body: JSON.stringify({ body_text: bodyText }),
      }),
    onSuccess: () => {
      setBodyText("");
      setError(null);
      router.refresh();
    },
    onError: (mutationError: Error) => {
      setError(mutationError.message);
      // A failed send is still persisted as a message with status "failed",
      // so refresh the thread to show it alongside the error.
      router.refresh();
    },
  });

  return (
    <div className="space-y-3">
      <textarea
        className="min-h-32 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-amber-400"
        placeholder={
          hasRealTransport
            ? "Напишите ответ клиенту — письмо уйдёт с почтового ящика канала."
            : "Напишите ответ клиенту. У этого канала нет настроенного транспорта, сообщение сохранится внутри CRM."
        }
        value={bodyText}
        onChange={(event) => setBodyText(event.target.value)}
      />
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <div className="flex justify-end">
        <Button
          onClick={() => reply.mutate()}
          disabled={reply.isPending || !bodyText.trim()}
        >
          {reply.isPending ? "Отправляем..." : "Отправить ответ"}
        </Button>
      </div>
    </div>
  );
}
