"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { clientRequest } from "@/lib/client-api";
import type { Permission } from "@/types/api";

type Props = {
  permissions: Permission[];
};

export function AdminRoleForm({ permissions }: Props) {
  const router = useRouter();
  const [selectedCodes, setSelectedCodes] = useState<string[]>([]);
  const [form, setForm] = useState({
    code: "",
    name: "",
    description: "",
  });

  const mutation = useMutation({
    mutationFn: () =>
      clientRequest("/admin/roles", {
        method: "POST",
        body: JSON.stringify({ ...form, permission_codes: selectedCodes }),
      }),
    onSuccess: () => {
      setForm({ code: "", name: "", description: "" });
      setSelectedCodes([]);
      router.refresh();
    },
  });

  const toggleCode = (code: string) => {
    setSelectedCodes((prev) => (prev.includes(code) ? prev.filter((item) => item !== code) : [...prev, code]));
  };

  return (
    <div className="space-y-3">
      <Input placeholder="код роли, например manager" value={form.code} onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value }))} />
      <Input placeholder="название роли, по-русски" value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} />
      <textarea
        className="min-h-24 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-amber-400"
        placeholder="что делает человек с этой ролью"
        value={form.description}
        onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
      />
      <p className="text-sm text-slate-700">Отметьте, что роли разрешено:</p>
      <div className="grid gap-2 md:grid-cols-2">
        {permissions.map((permission) => (
          <label key={permission.id} className="flex items-center gap-2 rounded-2xl bg-slate-50 px-3 py-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={selectedCodes.includes(permission.code)}
              onChange={() => toggleCode(permission.code)}
            />
            {/* Человеческое название, а не код: роль собирает админ студии */}
            <span title={permission.code}>{permission.name}</span>
          </label>
        ))}
      </div>
      <Button className="w-full" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
        {mutation.isPending ? "Создание..." : "Создать роль"}
      </Button>
    </div>
  );
}

