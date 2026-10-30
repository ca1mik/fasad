"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { clientRequest } from "@/lib/client-api";

const schema = z.object({
  login: z.string().min(2, "Введите логин"),
  password: z.string().min(4, "Минимум 4 символа"),
});

type FormValues = z.infer<typeof schema>;

export function LoginForm() {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    // Поля пустые. Раньше здесь стояли реальные значения seed-пользователя —
    // форма приходила заполненной, и вход был открыт любому, кто открыл страницу.
    defaultValues: {
      login: "",
      password: "",
    },
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      clientRequest<{ data: { token: { access_token: string } } }>("/auth/login", {
        method: "POST",
        body: JSON.stringify(values),
      }),
    onSuccess: (result) => {
      document.cookie = `access_token=${result.data.token.access_token}; path=/; SameSite=Lax`;
      router.push("/dashboard");
      router.refresh();
    },
  });

  return (
    <form className="space-y-4" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-700" htmlFor="login">
          Логин
        </label>
        <Input id="login" autoComplete="username" {...register("login")} />
        {errors.login ? <p className="text-sm text-red-600">{errors.login.message}</p> : null}
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-700" htmlFor="password">
          Пароль
        </label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          {...register("password")}
        />
        {errors.password ? <p className="text-sm text-red-600">{errors.password.message}</p> : null}
      </div>
      <Button className="w-full" type="submit" variant="secondary" disabled={mutation.isPending}>
        {mutation.isPending ? "Входим..." : "Войти в систему"}
      </Button>
      {mutation.isError ? (
        <p className="text-sm text-red-600">
          Неверный логин или пароль. Проверьте раскладку клавиатуры и попробуйте снова.
        </p>
      ) : null}
    </form>
  );
}

