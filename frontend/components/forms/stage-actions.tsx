"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { clientRequest } from "@/lib/client-api";

type Props = {
  stageId: string;
  currentStatus: string;
  requiresComment?: boolean;
};

type ActionPayload = {
  path: string;
  body: Record<string, string>;
};

export function StageActions({ stageId, currentStatus, requiresComment = false }: Props) {
  const router = useRouter();
  const [comment, setComment] = useState("");
  const [blockReason, setBlockReason] = useState("");

  const mutation = useMutation({
    mutationFn: async ({ path, body }: ActionPayload) =>
      clientRequest(path, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      setComment("");
      setBlockReason("");
      router.refresh();
    },
  });

  const isDone = currentStatus === "done";

  return (
    <div className="space-y-3">
      <Input
        value={comment}
        onChange={(event) => setComment(event.target.value)}
        placeholder={requiresComment ? "Комментарий обязателен для завершения" : "Комментарий к этапу"}
      />
      <div className="grid gap-3 md:grid-cols-3">
        <Button
          variant="secondary"
          disabled={isDone || mutation.isPending}
          onClick={() =>
            mutation.mutate({
              path: `/production/stages/${stageId}/start`,
              body: { comment },
            })
          }
        >
          Взять в работу
        </Button>
        <Button
          disabled={isDone || mutation.isPending}
          onClick={() =>
            mutation.mutate({
              path: `/production/stages/${stageId}/complete`,
              body: { comment },
            })
          }
        >
          Завершить этап
        </Button>
        <Button
          variant="outline"
          disabled={isDone || mutation.isPending || !blockReason.trim()}
          onClick={() =>
            mutation.mutate({
              path: `/production/stages/${stageId}/block`,
              body: { reason: blockReason, comment },
            })
          }
        >
          Заблокировать
        </Button>
      </div>
      <Input
        value={blockReason}
        onChange={(event) => setBlockReason(event.target.value)}
        placeholder="Причина блокировки"
      />
    </div>
  );
}
