"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { clientRequest } from "@/lib/client-api";

type Props = {
  orderId: string;
  disabled?: boolean;
};

export function ProductionBootstrapButton({ orderId, disabled = false }: Props) {
  const router = useRouter();
  const mutation = useMutation({
    mutationFn: async () =>
      clientRequest(`/orders/${orderId}/workflow/bootstrap`, {
        method: "POST",
        body: JSON.stringify({}),
      }),
    onSuccess: () => router.refresh(),
  });

  return (
    <Button
      variant="outline"
      disabled={disabled || mutation.isPending}
      onClick={() => mutation.mutate()}
    >
      {mutation.isPending ? "Запуск..." : "Запустить workflow"}
    </Button>
  );
}
