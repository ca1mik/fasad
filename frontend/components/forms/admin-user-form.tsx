"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { clientRequest } from "@/lib/client-api";
import type { Role } from "@/types/api";

type Props = {
  roles: Role[];
};

export function AdminUserForm({ roles }: Props) {
  const router = useRouter();
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    login: "",
    password: "",
    role_id: roles[0]?.id ?? "",
    is_active: true,
  });

  const mutation = useMutation({
    mutationFn: () =>
      clientRequest("/admin/users", {
        method: "POST",
        body: JSON.stringify(form),
      }),
    onSuccess: () => {
      setForm({
        full_name: "",
        email: "",
        login: "",
        password: "",
        role_id: roles[0]?.id ?? "",
        is_active: true,
      });
      router.refresh();
    },
  });

  return (
    <div className="space-y-3">
      <Input placeholder="ФИО сотрудника" value={form.full_name} onChange={(event) => setForm((prev) => ({ ...prev, full_name: event.target.value }))} />
      <Input placeholder="почта" value={form.email} onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))} />
      <Input placeholder="логин для входа" value={form.login} onChange={(event) => setForm((prev) => ({ ...prev, login: event.target.value }))} />
      <Input placeholder="пароль" type="password" value={form.password} onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))} />
      <select
        className="flex h-11 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm outline-none transition focus:border-amber-400"
        value={form.role_id}
        onChange={(event) => setForm((prev) => ({ ...prev, role_id: event.target.value }))}
      >
        {roles.map((role) => (
          <option key={role.id} value={role.id}>
            {role.name}
          </option>
        ))}
      </select>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={form.is_active}
          onChange={(event) => setForm((prev) => ({ ...prev, is_active: event.target.checked }))}
        />
        Работает — может входить в систему
      </label>
      <Button className="w-full" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
        {mutation.isPending ? "Создание..." : "Создать пользователя"}
      </Button>
      {mutation.isError ? <p className="text-sm text-red-600">Не удалось создать пользователя.</p> : null}
    </div>
  );
}

