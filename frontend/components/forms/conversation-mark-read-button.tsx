"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { clientRequest } from "@/lib/client-api";

type Props = {
  conversationId: string;
  disabled?: boolean;
};

export function ConversationMarkReadButton({ conversationId, disabled = false }: Props) {
  const router = useRouter();

  const action = useMutation({
    mutationFn: async () =>
      clientRequest(`/messaging/conversations/${conversationId}/mark-read`, {
        method: "POST",
      }),
    onSuccess: () => router.refresh(),
  });

  return (
    <Button
      variant="outline"
      onClick={() => action.mutate()}
      disabled={disabled || action.isPending}
    >
      Пометить прочитанным
    </Button>
  );
}
