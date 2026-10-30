"use client";

import { Card } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { getPatternByCode, type CuttingPattern, type LayoutGroup } from "@/lib/cutting-layout";

import { fallbackPattern } from "./lib";

type Props = {
  groups: LayoutGroup[];
  patterns: CuttingPattern[];
};

/**
 * Что заказать поставщику по этой раскладке.
 *
 * Заказчик: «площадь деталей вижу, а площадь плёнки, которую нужно заказать —
 * нет... чтобы менеджер уже видел, что на этот заказ надо такой-то плёнки
 * столько-то, чтобы она просто перебивала это в заявку поставщику». Раньше
 * менеджер считал это на бумаге по разложенным деталям.
 *
 * Считаем по картам, а не по деталям: заказывают не площадь фасадов, а куски
 * материала. Две цифры, потому что материал покупают двумя разными способами:
 * плёнку — погонными метрами с рулона, плиту — целыми листами.
 *
 * Занижать здесь нельзя: менеджер перебивает эти числа в заявку поставщику, и
 * недозаказ останавливает цех. Поэтому берём физический кусок целиком — с
 * полями листа и по полной ширине материала, а не по рабочей зоне.
 */
export function SupplySummary({ groups, patterns }: Props) {
  const rows = groups
    .map((group) => {
      const material = getPatternByCode(patterns, group.materialCode) ?? fallbackPattern;
      const sheets = group.sheets;
      const first = sheets[0];
      // Полная ширина материала: рулон приходит целиком, поля листа с него не
      // сэкономить. Раньше здесь стояла рабочая зона — и площадь выходила
      // меньше того, что реально нужно привезти.
      const acrossMm = first ? first.height : 0;
      // Физическая длина куска: от края листа до края, вместе с полями.
      // freeStripWidth — незанятый край справа, до которого детали не дошли;
      // всё остальное по длине уходит в дело.
      const lengthMm = sheets.reduce(
        (sum, sheet) => sum + Math.max(0, sheet.width - sheet.freeStripWidth),
        0,
      );
      const wholeSheetsSqm = sheets.reduce(
        (sum, sheet) => sum + (sheet.width * sheet.height) / 1_000_000,
        0,
      );
      return {
        key: group.pattern,
        material: material.name,
        thickness: group.thickness,
        article: group.article,
        sheets: sheets.length,
        lengthM: lengthMm / 1000,
        rollAreaSqm: (lengthMm * acrossMm) / 1_000_000,
        wholeSheetsSqm,
        detailAreaSqm: group.stats.detailArea,
      };
    })
    .filter((row) => row.sheets > 0);

  if (!rows.length) {
    return null;
  }

  const total = rows.reduce(
    (acc, row) => ({
      sheets: acc.sheets + row.sheets,
      lengthM: acc.lengthM + row.lengthM,
      rollAreaSqm: acc.rollAreaSqm + row.rollAreaSqm,
      wholeSheetsSqm: acc.wholeSheetsSqm + row.wholeSheetsSqm,
      detailAreaSqm: acc.detailAreaSqm + row.detailAreaSqm,
    }),
    { sheets: 0, lengthM: 0, rollAreaSqm: 0, wholeSheetsSqm: 0, detailAreaSqm: 0 },
  );

  return (
    <Card className="space-y-4">
      <div>
        <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Закупка</p>
        <h2 className="mt-2 text-xl font-semibold text-slate-900">Что заказать поставщику</h2>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-700">
          Считается по картам, а не по деталям: покупают материал, а не площадь фасадов.
          Плёнку берут погонными метрами с рулона — смотрите «длину» и «площадь с рулона».
          Плиту берут целыми листами — смотрите «целыми листами». Обе цифры больше площади
          деталей: разницу съедают зазоры, поля листа и обрезь.
        </p>
      </div>

      <div className="-mx-2 min-w-0 overflow-x-auto px-2">
        <Table>
          <THead>
            <TR>
              <TH>Материал</TH>
              <TH>Толщина</TH>
              <TH>Артикул</TH>
              <TH className="text-right">Листов</TH>
              <TH className="text-right">Длина</TH>
              <TH className="text-right">Площадь с рулона</TH>
              <TH className="text-right">Целыми листами</TH>
              <TH className="text-right">Площадь деталей</TH>
            </TR>
          </THead>
          <TBody>
            {rows.map((row) => (
              <TR key={row.key}>
                <TD className="font-medium text-slate-900">{row.material}</TD>
                <TD className="num whitespace-nowrap">
                  {row.thickness ? `${row.thickness} мм` : "—"}
                </TD>
                <TD className="num whitespace-nowrap">{row.article || "—"}</TD>
                <TD className="num text-right">{row.sheets}</TD>
                <TD className="num whitespace-nowrap text-right font-medium text-slate-900">
                  {row.lengthM.toFixed(3)} м
                </TD>
                <TD className="num whitespace-nowrap text-right font-medium text-slate-900">
                  {row.rollAreaSqm.toFixed(3)} м²
                </TD>
                <TD className="num whitespace-nowrap text-right">
                  {row.wholeSheetsSqm.toFixed(3)} м²
                </TD>
                <TD className="num whitespace-nowrap text-right text-slate-500">
                  {row.detailAreaSqm.toFixed(3)} м²
                </TD>
              </TR>
            ))}
            {rows.length > 1 ? (
              <TR>
                <TD className="font-semibold text-slate-900">Всего</TD>
                <TD />
                <TD />
                <TD className="num text-right font-semibold">{total.sheets}</TD>
                <TD className="num whitespace-nowrap text-right font-semibold">
                  {total.lengthM.toFixed(3)} м
                </TD>
                <TD className="num whitespace-nowrap text-right font-semibold">
                  {total.rollAreaSqm.toFixed(3)} м²
                </TD>
                <TD className="num whitespace-nowrap text-right font-semibold">
                  {total.wholeSheetsSqm.toFixed(3)} м²
                </TD>
                <TD className="num whitespace-nowrap text-right text-slate-500">
                  {total.detailAreaSqm.toFixed(3)} м²
                </TD>
              </TR>
            ) : null}
          </TBody>
        </Table>
      </div>
    </Card>
  );
}
