"use client";

import { useState } from "react";

import { CuttingLayoutUI } from "@/components/forms/cutting-layout-ui";
import { isRowFilled, rowQuantity, type LeadPartRow } from "@/components/forms/lead-parts-table";
import { ManualLeadForm } from "@/components/forms/manual-lead-form";
import { Button } from "@/components/ui/button";
import { createDraftPart, type CuttingPartDraft } from "@/lib/cutting-layout";
import { invalidPartQuantity, MAX_PART_UNITS } from "@/lib/part-quantity";
import type { FilmCuttingOptions, PaymentMethod, PriceItem, ReferenceValues } from "@/types/api";

type Props = {
  options: FilmCuttingOptions;
  priceItems: PriceItem[];
  referenceValues: ReferenceValues;
  /**
   * Направления для новой номенклатуры: «Эмаль», «Плёнка ПВХ», «Шпон».
   *
   * `kind` обязан доехать до формы заявки: под ним заводится артикул, набранный
   * руками. Пока тип был объявлен как `{code,label}`, поле проходило только
   * потому, что массив передавали как есть, — стоило его пересобрать, и тип
   * работ у артикула молча стал бы «Прочим».
   */
  priceKinds?: { code: string; label: string; kind?: string }[];
  /** Номер, который получит заявка, если поле оставить пустым — см. ManualLeadForm. */
  nextNumberHint?: string | null;
  /** Способы оплаты — для поля «Оплата при создании заказа», см. ManualLeadForm. */
  paymentMethods?: PaymentMethod[];
};

/**
 * Приём заявки и раскрой на одной странице.
 *
 * Заказчик: «из этой же таблицы уже раскрой». Таблица позиций живёт в форме
 * заявки, а карта раскроя — ниже; общее состояние держим здесь, чтобы одна и
 * та же строка не набиралась дважды.
 */
export function LeadIntakeWorkspace({
  options,
  priceItems,
  referenceValues,
  priceKinds = [],
  nextNumberHint,
  paymentMethods = [],
}: Props) {
  const [rows, setRows] = useState<LeadPartRow[]>([]);
  // Раскладку подменяем по нажатию, а не на каждую букву: пока менеджер правит
  // карту, ввод в форме не должен сбрасывать её из-под руки.
  const [seed, setSeed] = useState<{ drafts: CuttingPartDraft[]; version: number }>({
    drafts: [],
    version: 0,
  });

  const filled = rows.filter(isRowFilled);
  const detailCount = filled.reduce((sum, row) => sum + rowQuantity(row), 0);
  const invalidQuantity = rows.some((row) => invalidPartQuantity(row.quantity));

  function sendToCutting() {
    // Одна строка таблицы — несколько одинаковых деталей на листе, поэтому
    // количество разворачиваем в отдельные штуки: укладчик кладёт по одной.
    const drafts = filled.flatMap((row, index) =>
      Array.from({ length: rowQuantity(row) }, () =>
        createDraftPart({
          name: `Деталь ${index + 1}`,
          width: row.length.replace(",", "."),
          height: row.width.replace(",", "."),
          quantity: "1",
          rotate: false,
          gapX: "",
          gapY: "",
          // цвет и толщина делят карты, артикул — отдельная пачка в цех
          pattern: "",
          thickness: row.thickness,
          article: priceItems.find((item) => item.id === row.priceItemId)?.article ?? "",
        }),
      ),
    );
    setSeed((current) => ({ drafts, version: current.version + 1 }));
    document.getElementById("lead-cutting")?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <>
      <ManualLeadForm
        compact
        title="Занести новую заявку"
        description="Если клиент уже на месте или позвонил, этой формы достаточно для первичной фиксации."
        priceItems={priceItems}
        referenceValues={referenceValues}
        priceKinds={priceKinds}
        nextNumberHint={nextNumberHint}
        paymentMethods={paymentMethods}
        onRowsChange={setRows}
      />

      <section className="space-y-3" id="lead-cutting">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Раскрой на месте</p>
            <h2 className="mt-2 text-xl font-semibold text-slate-900">Детали и карта раскроя</h2>
            <p className="mt-1 max-w-3xl text-sm text-slate-700">
              Карта пересчитывается сразу, её можно показать клиенту с экрана. Кнопка справа
              переносит сюда позиции из таблицы заявки — вводить размеры второй раз не нужно.
            </p>
          </div>
          <Button type="button" disabled={!detailCount || detailCount > MAX_PART_UNITS || invalidQuantity} onClick={sendToCutting}>
            {detailCount
              ? detailCount > MAX_PART_UNITS
                ? `Для раскроя нужно не больше ${MAX_PART_UNITS} деталей`
                : `Разложить ${detailCount} дет. из таблицы`
              : "Заполните таблицу выше"}
          </Button>
        </div>
        <CuttingLayoutUI
          options={options}
          seedDrafts={seed.drafts}
          seedVersion={seed.version}
        />
      </section>
    </>
  );
}
