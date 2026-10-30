"use client";

import { useEffect, useState } from "react";

import { formatFileSize } from "@/lib/format";

type Attachment = {
  id: string;
  file_name: string;
  file_path: string;
  mime_type: string | null;
  size_bytes: number;
};

type Props = {
  attachments: Attachment[];
};

/**
 * Вложения заявки: фото замера, скан, файл от клиента.
 *
 * Раньше карточка печатала вложение как сырой служебный `file_path` текстом —
 * открыть файл из интерфейса было нельзя в принципе. Здесь тот же приём, что
 * и у файлов заказа (`OrderFiles`): миниатюра для фото, скачивание запросом
 * с авторизацией (обычная ссылка на /api/v1/... вернула бы 401 — токен живёт
 * в куке, а `Authorization` браузер по ссылке не шлёт).
 */
function authHeaders(): HeadersInit {
  const token = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith("access_token="))
    ?.split("=")[1];
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function isImage(item: Attachment) {
  return (item.mime_type ?? "").startsWith("image/");
}

function downloadUrl(id: string) {
  return `/api/v1/leads/attachments/${id}/download`;
}

function Thumb({ item }: { item: Attachment }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;

    const load = async () => {
      try {
        const response = await fetch(downloadUrl(item.id), { headers: authHeaders() });
        if (!response.ok) {
          return;
        }
        objectUrl = URL.createObjectURL(await response.blob());
        if (cancelled) {
          URL.revokeObjectURL(objectUrl);
          objectUrl = null;
          return;
        }
        setUrl(objectUrl);
      } catch {
        // Превью — удобство: не показалось, значит остаётся имя файла.
      }
    };

    void load();

    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [item.id]);

  if (!url) {
    return <div className="h-14 w-14 shrink-0 animate-pulse rounded-xl bg-slate-200" />;
  }

  return (
    <a href={url} target="_blank" rel="noreferrer" className="shrink-0" title="Открыть целиком">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={item.file_name} className="h-14 w-14 rounded-xl object-cover" />
    </a>
  );
}

async function download(item: Attachment) {
  const response = await fetch(downloadUrl(item.id), { headers: authHeaders() });
  if (!response.ok) {
    return;
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = item.file_name;
  link.click();
  URL.revokeObjectURL(url);
}

export function LeadAttachments({ attachments }: Props) {
  if (!attachments.length) {
    return <p className="text-sm text-slate-500">Вложений пока нет.</p>;
  }

  return (
    <div className="space-y-2">
      {attachments.map((item) => (
        <div
          key={item.id}
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3"
        >
          <div className="flex min-w-0 items-center gap-3">
            {isImage(item) ? <Thumb item={item} /> : null}
            <div className="min-w-0">
              <p className="truncate font-medium text-slate-900">{item.file_name}</p>
              <p className="text-sm text-slate-500">{formatFileSize(item.size_bytes)}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void download(item)}
            className="rounded-full px-3 py-1 text-sm font-medium text-amber-700 transition hover:bg-amber-50"
          >
            Скачать
          </button>
        </div>
      ))}
    </div>
  );
}
