"use client";

import { Download, Loader2 } from "lucide-react";
import { useState } from "react";

/**
 * Скачивание бланка заказа файлом Excel.
 *
 * Не обычная ссылка: API принимает токен только заголовком `Authorization`, а
 * переход по ссылке шлёт лишь куки — сервер ответил бы «не авторизован».
 * Поэтому файл забирается запросом и сохраняется уже из памяти.
 *
 * Excel, а не PDF: заказчик и сейчас ведёт заказы в таблицах, такой файл можно
 * переслать, доправить руками и распечатать откуда угодно.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

function readToken() {
  if (typeof document === "undefined") {
    return undefined;
  }
  return document.cookie
    .split("; ")
    .find((item) => item.startsWith("access_token="))
    ?.split("=")[1];
}

export function DownloadBlank({ leadId, fileName }: { leadId: string; fileName: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function download() {
    setBusy(true);
    setError(null);
    try {
      const token = readToken();
      const response = await fetch(`${API_URL}/leads/${leadId}/blank.xlsx`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) {
        throw new Error(`Сервер ответил ${response.status}`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${fileName}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Не удалось скачать бланк");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="print-hidden flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={download}
        disabled={busy}
        className="inline-flex h-10 items-center rounded-2xl border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:border-slate-400 disabled:opacity-60"
      >
        {busy ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Download className="mr-2 h-4 w-4" />
        )}
        Скачать Excel
      </button>
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </div>
  );
}
