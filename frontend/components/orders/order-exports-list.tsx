"use client";

import { useMutation } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import type { ExportFile } from "@/types/api";

type Props = {
  orderId: string;
  exports: ExportFile[];
};

/**
 * Раньше карточка «Экспорты» просто печатала `file_name`/`file_path` текстом
 * — ни один файл (ни CSV раскроя, ни сохранённую карту раскладки) нельзя
 * было реально скачать, только увидеть путь на диске сервера, бесполезный
 * без доступа к нему.
 *
 * Токен живёт в куке, а `Authorization` браузер сам по прямой ссылке не
 * шлёт — тот же приём, что и в файлах заказа (`order-files.tsx`): тянем
 * файл запросом и отдаём как blob.
 */
function authHeaders(): HeadersInit {
  const token = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith("access_token="))
    ?.split("=")[1];
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const EXPORT_TYPE_LABELS: Record<string, string> = {
  cutting: "Раскрой (CSV)",
  // Скачивается не JSON-снимок, а сохранённая вместе с ним SVG-карта —
  // см. CuttingExportService.get_download на бэкенде.
  cutting_layout: "Карта раскроя",
};

export function OrderExportsList({ orderId, exports }: Props) {
  const download = useMutation({
    mutationFn: async (item: ExportFile) => {
      const response = await fetch(`/api/v1/orders/${orderId}/exports/${item.id}/download`, {
        headers: authHeaders(),
      });
      if (!response.ok) {
        throw new Error("Файл не скачался");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = item.file_name;
      link.click();
      URL.revokeObjectURL(url);
    },
  });

  if (!exports.length) {
    return <p className="text-sm text-slate-500">Экспортов пока нет.</p>;
  }

  return (
    <div className="space-y-3">
      {exports.map((item) => (
        <div
          key={item.id}
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3"
        >
          <div className="min-w-0">
            <p className="font-medium text-slate-900">
              {EXPORT_TYPE_LABELS[item.export_type] ?? item.file_name}
            </p>
            <p className="text-sm text-slate-500">
              v{item.version} · {formatDate(item.created_at)}
            </p>
          </div>
          <Button
            variant="outline"
            disabled={download.isPending}
            onClick={() => download.mutate(item)}
          >
            Скачать
          </Button>
        </div>
      ))}
      {download.isError ? (
        <p className="text-sm text-rose-700">Файл не скачался — попробуйте ещё раз.</p>
      ) : null}
    </div>
  );
}
