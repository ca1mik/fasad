"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input, NumberInput } from "@/components/ui/input";
import { clientRequest } from "@/lib/client-api";
import type { StagePartProgress } from "@/types/api";

type Props = {
  stageId: string;
  parts: StagePartProgress[];
};

/** Количество из поля: пустое поле — это ноль, а не «не число». */
function toCount(value: string) {
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

export function PartReportForm({ stageId, parts }: Props) {
  const router = useRouter();
  const [partId, setPartId] = useState(parts[0]?.part.id ?? "");
  // Поля пустые, а не «1» и «0»: заказчик просила убрать единички — работник в
  // цеху встаёт в поле, чтобы забить своё число, и сначала вынужден стирать
  // чужое. С пустым полем первая же цифра — это его цифра.
  const [quantityDone, setQuantityDone] = useState("");
  const [quantityDefect, setQuantityDefect] = useState("");
  const [comment, setComment] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const selectedPart = useMemo(
    () => parts.find((item) => item.part.id === partId) ?? parts[0] ?? null,
    [partId, parts],
  );

  // Оба поля пустые — отчитываться не о чем: сервер такой отчёт отклоняет
  // («At least one quantity must be greater than zero»), а ошибку эта форма
  // работнику не показывает — кнопка просто молчала бы.
  const reported = toCount(quantityDone) > 0 || toCount(quantityDefect) > 0;

  const mutation = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      formData.append("part_id", partId);
      formData.append("quantity_done", String(toCount(quantityDone)));
      formData.append("quantity_defect", String(toCount(quantityDefect)));
      formData.append("report_status", toCount(quantityDefect) > 0 ? "defect" : "done");
      if (comment.trim()) {
        formData.append("comment", comment.trim());
      }
      if (file) {
        formData.append("file", file);
      }
      return clientRequest(`/production/stages/${stageId}/part-reports`, {
        method: "POST",
        body: formData,
      });
    },
    onSuccess: () => {
      setComment("");
      setFile(null);
      setQuantityDone("");
      setQuantityDefect("");
      router.refresh();
    },
  });

  if (!parts.length) {
    return (
      <p className="text-sm text-slate-500">
        Сначала сгенерируйте детали заказа. После этого работник сможет отчитываться по каждой детали отдельно.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <select
        value={partId}
        onChange={(event) => setPartId(event.target.value)}
        className="w-full rounded-full border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-400"
      >
        {parts.map((item) => (
          <option key={item.part.id} value={item.part.id}>
            {item.part.part_code} | {item.part.name} | осталось {item.remaining_quantity}
          </option>
        ))}
      </select>
      {selectedPart ? (
        <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
          Требуется: {selectedPart.required_quantity} | Уже отмечено: {selectedPart.reported_quantity} | Осталось:{" "}
          {selectedPart.remaining_quantity}
        </div>
      ) : null}
      <div className="grid gap-3 md:grid-cols-2">
        {/* Подпись вынесена над полем: раньше её роль играл placeholder, а он
            пропадал, как только в поле появлялась цифра, — и работник видел два
            одинаковых числа без объяснения, какое из них брак. */}
        <label className="space-y-1 text-xs text-slate-700">
          <span>Выполнено, шт.</span>
          <NumberInput
            type="number"
            min={0}
            measure="qty"
            value={quantityDone}
            onChange={(event) => setQuantityDone(event.target.value)}
            placeholder="0"
          />
        </label>
        <label className="space-y-1 text-xs text-slate-700">
          <span>Брак, шт.</span>
          <NumberInput
            type="number"
            min={0}
            measure="qty"
            value={quantityDefect}
            onChange={(event) => setQuantityDefect(event.target.value)}
            placeholder="0"
          />
        </label>
      </div>
      <Input
        value={comment}
        onChange={(event) => setComment(event.target.value)}
        placeholder="Комментарий по детали"
      />
      <Input
        type="file"
        accept="image/*"
        onChange={(event) => setFile(event.target.files?.[0] || null)}
      />
      <Button
        disabled={!partId || !reported || mutation.isPending}
        onClick={() => mutation.mutate()}
      >
        {mutation.isPending ? "Сохраняем..." : "Отчитаться по детали"}
      </Button>
      {partId && !reported ? (
        <p className="text-xs text-slate-500">
          Укажите, сколько сделано или сколько в брак. Пустой отчёт сервер не примет.
        </p>
      ) : null}
    </div>
  );
}
