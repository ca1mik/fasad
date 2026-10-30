import { ArrowRight, Factory, MailCheck, Ruler } from "lucide-react";

import { LoginForm } from "@/components/forms/login-form";
import { Card } from "@/components/ui/card";

export default function LoginPage() {
  return (
    <div className="app-grid flex min-h-screen items-center justify-center px-4 py-8">
      <div className="grid w-full max-w-6xl gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <Card className="flex flex-col justify-between gap-8 bg-slate-50 p-8">
          <div className="space-y-5">
            <p className="eyebrow">Фасадное производство</p>
            <div className="space-y-4">
              <h1 className="max-w-2xl">
                Заявки, раскрой, расчёт материалов и цех — в одной системе.
              </h1>
              <p className="max-w-2xl text-base leading-relaxed text-slate-700">
                Эмаль, ПВХ и шпон: приём заявок из почты и мессенджера, карта раскроя МДФ,
                расчёт плёнки и эмали на заказ, себестоимость и отчёты по направлениям.
              </p>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <MailCheck className="mb-4 h-5 w-5 text-amber-700" />
              <p className="font-medium text-slate-900">Заявки</p>
              <p className="mt-2 text-sm leading-relaxed text-slate-700">
                Из почты, из мессенджера и от клиентов в офисе — в одном окне.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <Ruler className="mb-4 h-5 w-5 text-amber-700" />
              <p className="font-medium text-slate-900">Раскрой и материалы</p>
              <p className="mt-2 text-sm leading-relaxed text-slate-700">
                Карта раскроя, полезный выход, остатки и заявка поставщику.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <Factory className="mb-4 h-5 w-5 text-amber-700" />
              <p className="font-medium text-slate-900">Цех</p>
              <p className="mt-2 text-sm leading-relaxed text-slate-700">
                Этапы с отметками рабочих и фото, себестоимость и зарплата.
              </p>
            </div>
          </div>
        </Card>
        <Card className="space-y-6 p-8">
          <div className="space-y-2">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">
              Вход в систему
            </p>
            <h2>Авторизация</h2>
            <p className="text-sm text-slate-700">
              Введите логин и пароль, которые вам выдал администратор.
            </p>
          </div>
          <LoginForm />
          <div className="rounded-2xl bg-amber-100 p-4 text-sm text-slate-700">
            Не помните пароль — обратитесь к администратору системы, он выдаст новый.
            <div className="mt-3 flex items-center gap-2 text-slate-900">
              <ArrowRight className="h-4 w-4" />
              <span>После входа откроется сводка по заявкам, заказам и производству.</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

