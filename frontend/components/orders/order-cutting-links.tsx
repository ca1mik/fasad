"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { clientRequest } from "@/lib/client-api";

type Props = {
  orderId: string;
  /** Есть ли в смете хоть одна позиция kind="film" (плёнка ПВХ). */
  hasFilmPositions: boolean;
  /** Заявка, из которой вырос заказ — бланк печатается по её позициям. */
  sourceLeadId: string | null;
};

function errorText(error: unknown) {
  return error instanceof Error && error.message ? error.message : "Не удалось выгрузить раскрой";
}

/**
 * Заголовок авторизации из куки.
 *
 * Токен живёт в куке, а `Authorization` браузер сам по прямой ссылке не
 * шлёт — обычный `<a href>` на скачивание получил бы 401. Поэтому файл тянем
 * запросом и отдаём как blob, тем же приёмом, что и в файлах заказа.
 */
function authHeaders(): HeadersInit {
  const token = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith("access_token="))
    ?.split("=")[1];
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Раскрой заказа, бланк и выгрузка — одно место вместо трёх повторяющихся
 * кнопок «Открыть раскрой», разбросанных по карточке заказа.
 *
 * Заказчик: «эмаль и всё остальное — только бланк раскроя МДФ; плёнка — это
 * ещё и раскрой плёнки». То есть у заказа всегда есть раскрой МДФ (по
 * толщине — распил), а если в смете есть плёночные позиции, добавляется
 * отдельная ссылка на раскрой плёнки: это не альтернатива, а вдобавок.
 */
export function OrderCuttingLinks({ orderId, hasFilmPositions, sourceLeadId }: Props) {
  const router = useRouter();

  const exportCutting = useMutation({
    mutationFn: async () => clientRequest(`/orders/${orderId}/export-cutting`, { method: "POST" }),
    onSuccess: () => router.refresh(),
  });

  const downloadBlank = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/v1/leads/${sourceLeadId}/blank.xlsx`, {
        headers: authHeaders(),
      });
      if (!response.ok) {
        throw new Error("Бланк не скачался");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "blank.xlsx";
      link.click();
      URL.revokeObjectURL(url);
    },
  });

  return (
    <div className="space-y-3">
      {/* flex-nowrap + overflow-x-auto, а не flex-wrap: заказчик — «сделай в
          строку 1, чтоб было понятно», кнопки не должны расползаться на две
          строки. На узком экране лучше горизонтальная прокрутка, чем ряд,
          который сам решает, где перенестись. */}
      <div className="flex flex-nowrap items-center gap-3 overflow-x-auto pb-1">
        <Button asChild>
          <Link href={`/film-cutting?orderId=${orderId}&type=cutting`}>Раскрой МДФ</Link>
        </Button>
        {hasFilmPositions ? (
          <Button asChild variant="outline">
            <Link href={`/film-cutting?orderId=${orderId}&type=film`}>Раскрой плёнки</Link>
          </Button>
        ) : null}
        {sourceLeadId ? (
          <Button
            variant="outline"
            disabled={downloadBlank.isPending}
            onClick={() => downloadBlank.mutate()}
          >
            {downloadBlank.isPending ? "Скачиваю…" : "Скачать бланк"}
          </Button>
        ) : null}
        {/* Печать карт раскроя — та же страница, что была на заявке
            (`/leads/{id}/cutting`) с готовым скачиванием PDF/SVG. Заказчик:
            «как в старой, только в новом» — карты раскроя нужны прямой
            кнопкой рядом с бланком, а не искать их в списке «Экспорты».
            МДФ/плёнка разведены так же, как «Раскрой МДФ»/«Раскрой плёнки»
            выше — иначе карта плёнки печаталась бы по правилам распила
            (делится по толщине), которые к плёнке не подходят: заказчик
            прямо спрашивал «нужна карта раскроя мдф и карта раскроя
            плёнки, если это плёнка». orderId в ссылке — чтобы источником
            деталей была смета ЭТОГО заказа (OrderPosition, с kind), а не
            весь список деталей заявки одной кучей. */}
        {sourceLeadId ? (
          <Button asChild variant="outline">
            <Link href={`/leads/${sourceLeadId}/cutting?orderId=${orderId}&type=cutting`}>
              Карты раскроя МДФ
            </Link>
          </Button>
        ) : null}
        {sourceLeadId && hasFilmPositions ? (
          <Button asChild variant="outline">
            <Link href={`/leads/${sourceLeadId}/cutting?orderId=${orderId}&type=film`}>
              Карты раскроя плёнки
            </Link>
          </Button>
        ) : null}
        <Button
          variant="outline"
          disabled={exportCutting.isPending}
          onClick={() => exportCutting.mutate()}
        >
          {exportCutting.isPending ? "Выгружаю…" : "Выгрузить раскрой (CSV)"}
        </Button>
      </div>
      {exportCutting.isError ? (
        <p className="text-sm text-rose-700">{errorText(exportCutting.error)}</p>
      ) : null}
      {exportCutting.isSuccess ? (
        <p className="text-sm text-emerald-700">Готово — файл в списке «Экспорты» ниже.</p>
      ) : null}
      {downloadBlank.isError ? (
        <p className="text-sm text-rose-700">Бланк не скачался — попробуйте ещё раз.</p>
      ) : null}
    </div>
  );
}
