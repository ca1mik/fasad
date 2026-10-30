"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { clientRequest } from "@/lib/client-api";
import { formatDate, formatFileSize } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { OrderFile } from "@/types/api";

type Props = {
  orderId: string;
  files: OrderFile[];
};

const ATTACHMENT_TYPE = "attachment";

/**
 * Лимит на один файл. Обязан совпадать с `order_file_max_mb`
 * (backend/app/core/config.py): сервер всё равно проверит, но гнать по сети
 * 40-мегабайтное фото, чтобы получить отказ, незачем — на телефоне в цехе это
 * минута ожидания впустую.
 */
const MAX_FILE_MB = 25;

/** Что подсказываем выбрать: фото с телефона, сканы, документы, таблицы, чертежи. */
const ACCEPT = "image/*,application/pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.dxf,.dwg";

function errorText(error: unknown) {
  return error instanceof Error && error.message ? error.message : "Не удалось приложить файл";
}

/**
 * Заголовок авторизации из куки.
 *
 * Токен живёт в куке, а `Authorization` браузер сам не шлёт — ни по ссылке, ни
 * в `<img src>`. Поэтому и скачивание, и превью идут запросом.
 */
function authHeaders(): HeadersInit {
  const token = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith("access_token="))
    ?.split("=")[1];
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function isImage(item: OrderFile) {
  return (item.content_type ?? "").startsWith("image/");
}

/**
 * Миниатюра фотографии.
 *
 * Менеджеру нужно видеть, что прислал клиент, а не строку «IMG_2024.jpg»:
 * замеры и эскизы узнают глазами. Прямой `<img src>` на эндпоинт скачивания
 * вернул бы 401, поэтому тянем содержимое запросом и показываем как blob,
 * освобождая ссылку при размонтировании.
 */
function Thumb({ item }: { item: OrderFile }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;

    const load = async () => {
      try {
        const response = await fetch(`/api/v1/documents/${item.id}/download`, {
          headers: authHeaders(),
        });
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
        // Превью — удобство, а не работа: не показалось, значит остаётся имя файла.
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

export function OrderFiles({ orderId, files }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [chosen, setChosen] = useState<File[]>([]);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  /**
   * Добавление к уже выбранному, а не замена.
   *
   * Фото замера лежат в галерее вперемешку, и менеджер набирает их в несколько
   * заходов. Тяжёлые отсекаем сразу и говорим, какие именно, — иначе человек
   * жмёт «Приложить» и получает отказ без объяснения.
   */
  const addFiles = (incoming: FileList | null) => {
    const list = incoming ? Array.from(incoming) : [];
    if (!list.length) {
      return;
    }
    const limit = MAX_FILE_MB * 1024 * 1024;
    const tooBig = list.filter((file) => file.size > limit).map((file) => file.name);
    const fitting = list.filter((file) => file.size <= limit);

    setError(
      tooBig.length ? `Больше ${MAX_FILE_MB} МБ, не приложены: ${tooBig.join(", ")}` : null,
    );
    setChosen((prev) => {
      const known = new Set(prev.map((file) => `${file.name}:${file.size}`));
      return [...prev, ...fitting.filter((file) => !known.has(`${file.name}:${file.size}`))];
    });
  };

  const dropChosen = (name: string, size: number) =>
    setChosen((prev) => prev.filter((file) => !(file.name === name && file.size === size)));

  /**
   * Отправка по одному файлу в существующий эндпоинт.
   *
   * Контракт не меняем: сервер принимает один файл за запрос, поэтому шлём
   * последовательно и показываем, на каком именно файле находимся. Упавшие
   * перечисляем по именам — молчаливая потеря одного фото из восьми хуже
   * честного списка.
   */
  const upload = useMutation({
    mutationFn: async () => {
      if (!chosen.length) {
        throw new Error("Выберите файлы");
      }
      const failed: string[] = [];
      for (let index = 0; index < chosen.length; index += 1) {
        const file = chosen[index];
        setProgress(`Загружаю ${index + 1} из ${chosen.length}: ${file.name}`);
        const form = new FormData();
        form.append("file", file);
        if (comment.trim()) {
          form.append("comment", comment.trim());
        }
        try {
          await clientRequest(`/orders/${orderId}/files`, { method: "POST", body: form });
        } catch {
          failed.push(file.name);
        }
      }
      return failed;
    },
    onSuccess: (failed: string[]) => {
      setProgress(null);
      setChosen([]);
      setComment("");
      if (inputRef.current) {
        inputRef.current.value = "";
      }
      setError(failed.length ? `Не удалось приложить: ${failed.join(", ")}` : null);
      router.refresh();
    },
    onError: (mutationError: unknown) => {
      setProgress(null);
      setError(errorText(mutationError));
    },
  });

  const remove = useMutation({
    mutationFn: async (documentId: string) =>
      clientRequest(`/documents/${documentId}`, { method: "DELETE" }),
    onSuccess: () => router.refresh(),
    onError: (mutationError: unknown) => setError(errorText(mutationError)),
  });

  /** Удаление невосстановимо — спрашиваем. */
  const askRemove = (item: OrderFile) => {
    if (window.confirm(`Удалить «${item.file_name}»? Файл не восстановить.`)) {
      remove.mutate(item.id);
    }
  };

  /**
   * Скачивание через fetch, а не обычной ссылкой.
   *
   * Токен живёт в куке, но заголовок Authorization браузер по ссылке не шлёт —
   * сервер ответил бы 401. Поэтому тянем файл запросом и отдаём как blob.
   */
  const download = useMutation({
    mutationFn: async (item: OrderFile) => {
      const response = await fetch(`/api/v1/documents/${item.id}/download`, {
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
    onError: (mutationError: unknown) => setError(errorText(mutationError)),
  });

  return (
    <div className="space-y-4">
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragOver(false);
          addFiles(event.dataTransfer?.files ?? null);
        }}
        className={cn(
          "space-y-3 rounded-2xl border border-dashed p-4 transition",
          dragOver ? "border-amber-400 bg-amber-50/60" : "border-slate-300",
        )}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT}
          onChange={(event) => addFiles(event.target.files)}
          className="block w-full text-sm text-slate-700 file:mr-4 file:rounded-full file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:text-sm file:text-white hover:file:bg-slate-800"
        />
        <p className="text-sm text-slate-500">
          Можно выбрать сразу несколько или перетащить файлы сюда. До {MAX_FILE_MB} МБ каждый.
        </p>

        {chosen.length ? (
          <div className="flex flex-wrap gap-2">
            {chosen.map((file) => (
              <span
                key={`${file.name}:${file.size}`}
                className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700"
              >
                <span className="max-w-[220px] truncate">{file.name}</span>
                <span className="num text-slate-500">{formatFileSize(file.size)}</span>
                <button
                  type="button"
                  onClick={() => dropChosen(file.name, file.size)}
                  className="text-slate-400 transition hover:text-rose-600"
                  title="Убрать из выбранных"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <Input
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder="Комментарий — что это за файлы"
            className="min-w-[220px] flex-1"
          />
          <Button disabled={!chosen.length || upload.isPending} onClick={() => upload.mutate()}>
            {upload.isPending
              ? "Загружаю…"
              : chosen.length > 1
                ? `Приложить ${chosen.length}`
                : "Приложить"}
          </Button>
        </div>

        {progress ? <p className="text-sm text-slate-600">{progress}</p> : null}
      </div>

      {files.length ? (
        <div className="space-y-2">
          {files.map((item) => (
            <div
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3"
            >
              <div className="flex min-w-0 items-center gap-3">
                {isImage(item) ? <Thumb item={item} /> : null}
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-900">{item.file_name}</p>
                  <p className="text-sm text-slate-500">
                    {formatFileSize(item.size_bytes)} · {formatDate(item.created_at)}
                    {item.author_name ? ` · ${item.author_name}` : ""}
                    {item.doc_type === ATTACHMENT_TYPE ? "" : " · выгрузка системы"}
                  </p>
                  {item.comment ? (
                    <p className="mt-1 text-sm text-slate-700">{item.comment}</p>
                  ) : null}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => download.mutate(item)}
                  className="rounded-full px-3 py-1 text-sm font-medium text-amber-700 transition hover:bg-amber-50"
                >
                  Скачать
                </button>
                {item.doc_type === ATTACHMENT_TYPE ? (
                  <button
                    type="button"
                    disabled={remove.isPending}
                    onClick={() => askRemove(item)}
                    className="rounded-full px-3 py-1 text-sm text-slate-500 transition hover:bg-rose-50 hover:text-rose-600"
                  >
                    Удалить
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-500">Файлов пока нет.</p>
      )}

      {error ? (
        <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
      ) : null}
    </div>
  );
}
