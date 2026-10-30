import { DirectionsManager } from "@/components/forms/directions-manager";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/api";

export default async function DirectionsPage() {
  const directions = await api.getAllDirections();

  return (
    <AppShell currentPath="/admin">
      <PageHeader
        eyebrow="Администрирование"
        title="Направления и буквы номеров"
        description="Буква номера заказа («0002-П») берётся отсюда — из «Буквы номера» выбранного направления. Пусто — заказ идёт без буквы, как у эмали."
      />

      <Card>
        <div className="space-y-2 text-sm text-slate-700">
          <p>
            Направление выбирается при приёме заявки и на карточке заказа. Буква в номере
            подставляется автоматически — направление главнее, а если оно не выбрано, буква
            берётся по типу работ строк сметы.
          </p>
          <p>
            Заказ с номером, вписанным менеджером вручную, буквы не получает никогда — своя
            нумерация студии главнее автоматической.
          </p>
        </div>
      </Card>

      <Card>
        <DirectionsManager directions={directions} />
      </Card>
    </AppShell>
  );
}
