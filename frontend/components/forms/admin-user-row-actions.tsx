"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { clientRequest } from "@/lib/client-api";
import type { AdminUser, Role } from "@/types/api";

type Props = {
  user: AdminUser;
  roles: Role[];
};

export function AdminUserRowActions({ user, roles }: Props) {
  const router = useRouter();
  const [roleId, setRoleId] = useState(user.role.id);
  const [isActive, setIsActive] = useState(user.is_active);
  const [password, setPassword] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      clientRequest(`/admin/users/${user.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          role_id: roleId,
          is_active: isActive,
          password: password || undefined,
        }),
      }),
    onSuccess: () => {
      setPassword("");
      router.refresh();
    },
  });

  return (
    <div className="space-y-3 rounded-2xl bg-slate-50 p-4">
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
        <select
          className="flex h-11 rounded-2xl border border-slate-300 bg-white px-4 text-sm outline-none transition focus:border-amber-400"
          value={roleId}
          onChange={(event) => setRoleId(event.target.value)}
        >
          {roles.map((role) => (
            <option key={role.id} value={role.id}>
              {role.name}
            </option>
          ))}
        </select>
        <Input placeholder="новый пароль" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} />
          Работает
        </label>
        <Button size="sm" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
          Сохранить
        </Button>
      </div>
    </div>
  );
}

