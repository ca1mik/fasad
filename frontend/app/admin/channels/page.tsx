import { ChannelAccountCard } from "@/components/forms/channel-account-card";
import { ChannelAccountForm } from "@/components/forms/channel-account-form";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/api";
import type { MessagingUserSummary } from "@/types/api";

export default async function AdminChannelsPage() {
  const [channels, users] = await Promise.all([api.getChannelAccounts(), api.getAdminUsers()]);

  const managers: MessagingUserSummary[] = users.map((user) => ({
    id: user.id,
    full_name: user.full_name,
    login: user.login,
  }));

  const emailChannels = channels.filter((channel) => channel.channel_type === "email");
  const otherChannels = channels.filter((channel) => channel.channel_type !== "email");

  return (
    <AppShell currentPath="/admin">
      <PageHeader
        eyebrow="Администрирование"
        title="Каналы связи"
        description="Email-канал работает по-настоящему: планировщик забирает письма по IMAP, заявка попадает в диалоги, ответ менеджера уходит по SMTP. Пароли хранятся зашифрованными и в API не возвращаются."
      />

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)]">
        <div className="space-y-6">
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">Каналы почты</h2>
            {emailChannels.length ? (
              emailChannels.map((channel) => (
                <ChannelAccountCard key={channel.id} account={channel} managers={managers} />
              ))
            ) : (
              <Card>
                <p className="text-sm text-slate-700">
                  Каналы почты ещё не настроены. Создайте канал в форме справа: понадобятся
                  IMAP/SMTP-серверы почтового провайдера и пароль приложения.
                </p>
              </Card>
            )}
          </div>

          {otherChannels.length ? (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-slate-900">Остальные каналы</h2>
              <p className="text-sm text-slate-700">
                Контуры для Telegram, WhatsApp и generic webhook. Реальные транспорты для них
                подключаются в следующих фазах.
              </p>
              {otherChannels.map((channel) => (
                <ChannelAccountCard key={channel.id} account={channel} managers={managers} />
              ))}
            </div>
          ) : null}
        </div>

        <Card className="space-y-4">
          <div>
            <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Новый канал</p>
            <h2 className="mt-2 text-xl font-semibold text-slate-900">Подключить почту</h2>
            <p className="mt-2 text-sm text-slate-700">
              После сохранения нажмите «Проверить соединение» на карточке канала — это подтвердит
              логин на IMAP и SMTP до того, как планировщик начнёт опрос.
            </p>
          </div>
          <ChannelAccountForm managers={managers} />
        </Card>
      </section>
    </AppShell>
  );
}
