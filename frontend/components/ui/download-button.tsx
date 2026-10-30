"use client";

import { useState } from "react";

import { Button, type ButtonProps } from "@/components/ui/button";

type Props = Omit<ButtonProps, "onClick" | "asChild"> & {
  /** Путь внутри API, например `/reports/volume.xlsx?period=month`. */
  path: string;
  children: React.ReactNode;
};

/**
 * Скачивание файла с авторизацией.
 *
 * Обычной ссылкой файл не забрать: токен лежит в куке, а заголовок
 * `Authorization` браузер по `<a href>` не отправляет — сервер ответил бы 401.
 * Поэтому тянем запросом и отдаём как blob, а имя берём из заголовка ответа —
 * там оно уже по-русски, по RFC 5987.
 */
export function DownloadButton({ path, children, ...buttonProps }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function download() {
    setBusy(true);
    setError(null);
    try {
      const token = document.cookie
        .split("; ")
        .find((entry) => entry.startsWith("access_token="))
        ?.split("=")[1];

      const response = await fetch(`/api/v1${path}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) {
        throw new Error(`Сервер отказал (${response.status})`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileNameFrom(response.headers.get("content-disposition"), path);
      link.click();
      URL.revokeObjectURL(url);
    } catch (downloadError) {
      setError(
        downloadError instanceof Error && downloadError.message
          ? downloadError.message
          : "Не удалось скачать файл",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <Button {...buttonProps} disabled={busy || buttonProps.disabled} onClick={download}>
        {busy ? "Готовлю файл…" : children}
      </Button>
      {error ? <span className="text-xs text-rose-600">{error}</span> : null}
    </span>
  );
}

/** Имя файла из `Content-Disposition`; в запасе — хвост адреса. */
function fileNameFrom(header: string | null, path: string) {
  const encoded = header?.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  if (encoded) {
    try {
      return decodeURIComponent(encoded);
    } catch {
      // имя пришло битым — упадём на запасной вариант ниже
    }
  }
  const plain = header?.match(/filename="([^"]+)"/i)?.[1];
  return plain || path.split("?")[0].split("/").pop() || "file";
}
