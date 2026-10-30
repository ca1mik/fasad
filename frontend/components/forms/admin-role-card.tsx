"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { clientRequest } from "@/lib/client-api";
import type { Permission, Role } from "@/types/api";

type Props = {
  role: Role;
  permissions: Permission[];
};

export function AdminRoleCard({ role, permissions }: Props) {
  const router = useRouter();
  const [name, setName] = useState(role.name);
  const [description, setDescription] = useState(role.description || "");
  const [selectedCodes, setSelectedCodes] = useState(role.permissions.map((item) => item.code));

  const mutation = useMutation({
    mutationFn: () =>
      clientRequest(`/admin/roles/${role.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name,
          description,
          permission_codes: selectedCodes,
        }),
      }),
    onSuccess: () => router.refresh(),
  });

  const toggleCode = (code: string) => {
    setSelectedCodes((prev) => (prev.includes(code) ? prev.filter((item) => item !== code) : [...prev, code]));
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{role.code}</p>
        <input
          className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-amber-400"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <textarea
          className="min-h-20 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-amber-400"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </div>
      <div className="mt-4 grid gap-2 md:grid-cols-2">
        {permissions.map((permission) => (
          <label key={permission.id} className="flex items-center gap-2 rounded-2xl bg-white px-3 py-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={selectedCodes.includes(permission.code)}
              onChange={() => toggleCode(permission.code)}
            />
            {/* Название по-русски: роль собирает админ студии, а не программист */}
            <span title={permission.code}>{permission.name}</span>
          </label>
        ))}
      </div>
      <div className="mt-4">
        <Button size="sm" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
          Сохранить роль
        </Button>
      </div>
    </div>
  );
}

