"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { clientRequest } from "@/lib/client-api";

export function AdminPermissionForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      clientRequest("/admin/permissions", {
        method: "POST",
        body: JSON.stringify({ code, name }),
      }),
    onSuccess: () => {
      setCode("");
      setName("");
      router.refresh();
    },
  });

  return (
    <div className="space-y-3">
      {/* Код остаётся английским: на него завязаны проверки в коде. А вот
          название читает тот, кто раздаёт доступы, — оно должно быть по-русски
          и по делу. */}
      <Input
        placeholder="код, например orders.manage"
        value={code}
        onChange={(event) => setCode(event.target.value)}
      />
      <Input
        placeholder="что разрешает, по-русски"
        value={name}
        onChange={(event) => setName(event.target.value)}
      />
      <Button className="w-full" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
        {mutation.isPending ? "Создание..." : "Добавить право"}
      </Button>
    </div>
  );
}

