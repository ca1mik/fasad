/**
 * Инварианты раскладки — то, что обязано выполняться при ЛЮБЫХ настройках.
 *
 * Файл рядом (cutting-layout.test.ts) фиксирует конкретные разобранные случаи.
 * Здесь другое: одни и те же свойства прогоняются по всем алгоритмам, с поворотом
 * и без, с зазором у кромки и без, на полутора десятках наборов деталей. Так
 * ловятся не «вот эта деталь легла не туда», а поломки, которые вылезают только
 * на определённом сочетании настроек.
 *
 * Проверяем ровно то, за что заказчик хватался руками: карта без деталей,
 * пропавшая деталь, детали внахлёст и раскладка, которая «каждый раз разная».
 * Последнее особенно: раскладка обязана быть детерминированной, иначе менеджер
 * и цех смотрят на разные карты одного заказа.
 */

import { describe, expect, it } from "vitest";

import {
  createDraftPart,
  normalizeDrafts,
  packLayout,
  packLayoutByPattern,
  pickBestPlacement,
  type CuttingSheetSettings,
  type LayoutPackResult,
  type PartOrdering,
  type SheetSelection,
} from "./cutting-layout";

const SIZES: Array<[number, number]> = [
  [145, 630], [145, 1230], [716, 396], [596, 396], [346, 536], [176, 536],
  [736, 446], [1436, 596], [756, 596], [1006, 396], [456, 296], [356, 536],
  [946, 596], [646, 716], [234, 721], [234, 521], [396, 296], [2586, 396],
];

function base(overrides: Partial<CuttingSheetSettings> = {}): CuttingSheetSettings {
  return {
    sheetWidth: 2800,
    sheetHeight: 2070,
    marginX: 8,
    marginY: 8,
    defaultGapX: 4,
    defaultGapY: 4,
    algorithm: "leftEdge",
    allowRotation: true,
    keepEdgeGap: true,
    workKind: "cutting",
    ...overrides,
  };
}

function makeDrafts(seed: number, count: number) {
  let s = seed;
  const rnd = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
  return Array.from({ length: count }, (_, i) => {
    const [w, h] = SIZES[Math.floor(rnd() * SIZES.length)];
    return createDraftPart({
      id: `p${i}`,
      name: `Деталь ${i + 1}`,
      width: String(w),
      height: String(h),
      quantity: String(1 + Math.floor(rnd() * 3)),
      pattern: rnd() < 0.25 ? "graphite_matt" : "white_gloss",
      thickness: rnd() < 0.15 ? "5" : "19",
      rotate: rnd() < 0.1,
    });
  });
}

function fingerprint(layout: ReturnType<typeof packLayoutByPattern>) {
  return layout.sheets
    .map((s) =>
      `${s.globalIndex}|${s.pattern}|` +
      s.placements.map((p) => `${p.sourceNumber}@${p.x},${p.y},${p.width}x${p.height},${p.rotated}`).join(";"),
    )
    .join("\n");
}

const ALGORITHMS: CuttingSheetSettings["algorithm"][] = ["leftEdge", "byLength", "byWidth", "optimal"];

describe("раскладка: широкая проверка", () => {
  it("одинаковый ввод даёт одинаковую раскладку (никакой случайности)", () => {
    for (let seed = 1; seed <= 15; seed += 1) {
      const drafts = makeDrafts(seed, 45);
      const a = fingerprint(packLayoutByPattern(normalizeDrafts(drafts, "white_gloss"), base()));
      const b = fingerprint(packLayoutByPattern(normalizeDrafts(drafts, "white_gloss"), base()));
      expect(b, `seed ${seed}`).toBe(a);
    }
  });

  it("нет карт без деталей и нет нулевого заполнения — на всех алгоритмах", () => {
    const problems: string[] = [];
    for (const algorithm of ALGORITHMS) {
      for (const allowRotation of [true, false]) {
        for (const keepEdgeGap of [true, false]) {
          for (let seed = 1; seed <= 8; seed += 1) {
            const parts = normalizeDrafts(makeDrafts(seed, 45), "white_gloss");
            const layout = packLayoutByPattern(parts, base({ algorithm, allowRotation, keepEdgeGap }));
            for (const sheet of layout.sheets) {
              if (!sheet.placements.length || sheet.fillPercent <= 0) {
                problems.push(`${algorithm}/rot=${allowRotation}/gap=${keepEdgeGap} seed ${seed}: карта ${sheet.globalIndex} пустая`);
              }
            }
          }
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it("детали не теряются и не задваиваются", () => {
    const problems: string[] = [];
    for (const algorithm of ALGORITHMS) {
      for (let seed = 1; seed <= 10; seed += 1) {
        const parts = normalizeDrafts(makeDrafts(seed, 45), "white_gloss");
        const requested = parts.reduce((n, p) => n + p.quantity, 0);
        const layout = packLayoutByPattern(parts, base({ algorithm }));
        const placed = layout.sheets.reduce((n, s) => n + s.placements.length, 0);
        const ids = new Set(layout.sheets.flatMap((s) => s.placements.map((p) => p.unitId)));
        if (placed + layout.unplaced.length !== requested) {
          problems.push(`${algorithm} seed ${seed}: заявлено ${requested}, разложено ${placed}, не влезло ${layout.unplaced.length}`);
        }
        if (ids.size !== placed) {
          problems.push(`${algorithm} seed ${seed}: одна деталь легла дважды`);
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it("детали не вылезают за рабочую зону и не наезжают друг на друга", () => {
    const problems: string[] = [];
    for (const algorithm of ALGORITHMS) {
      for (let seed = 1; seed <= 10; seed += 1) {
        const parts = normalizeDrafts(makeDrafts(seed, 45), "white_gloss");
        const layout = packLayoutByPattern(parts, base({ algorithm }));
        for (const sheet of layout.sheets) {
          for (const p of sheet.placements) {
            if (
              p.x < sheet.marginX - 0.001 ||
              p.y < sheet.marginY - 0.001 ||
              p.x + p.width > sheet.marginX + sheet.workWidth + 0.001 ||
              p.y + p.height > sheet.marginY + sheet.workHeight + 0.001
            ) {
              problems.push(`${algorithm} seed ${seed}: деталь #${p.sourceNumber} вне рабочей зоны`);
            }
          }
          for (let i = 0; i < sheet.placements.length; i += 1) {
            for (let j = i + 1; j < sheet.placements.length; j += 1) {
              const a = sheet.placements[i];
              const b = sheet.placements[j];
              const overlap =
                a.x < b.x + b.width - 0.001 &&
                a.x + a.width > b.x + 0.001 &&
                a.y < b.y + b.height - 0.001 &&
                a.y + a.height > b.y + 0.001;
              if (overlap) {
                problems.push(`${algorithm} seed ${seed}: #${a.sourceNumber} и #${b.sourceNumber} наезжают`);
              }
            }
          }
        }
      }
    }
    expect(problems.slice(0, 10)).toEqual([]);
  });

  it("«прижать влево»: деталь не стоит правее, чем могла бы", () => {
    const problems: string[] = [];
    for (let seed = 1; seed <= 15; seed += 1) {
      const parts = normalizeDrafts(makeDrafts(seed, 45), "white_gloss");
      const layout = packLayoutByPattern(parts, base({ algorithm: "leftEdge" }));
      for (const sheet of layout.sheets) {
        for (const p of sheet.placements) {
          const limit = sheet.placements
            .filter((o) => o !== p && o.y < p.y + p.footprintHeight && o.y + o.footprintHeight > p.y && o.x + o.footprintWidth <= p.x)
            .reduce((m, o) => Math.max(m, o.x + o.footprintWidth), sheet.marginX);
          if (p.x - limit > 1) {
            problems.push(`seed ${seed}: #${p.sourceNumber} на x=${Math.round(p.x)}, влезала на ${Math.round(limit)}`);
          }
        }
      }
    }
    expect(problems.slice(0, 10)).toEqual([]);
  });

  it("листы 1..n-1 забиты плотнее всех вариантов, остаток сведён на последний", () => {
    // Заказчик: «если задействуются n листов, то с 0 по n-1 забита максимальная
    // площадь, а на n листе справа остаётся максимальный остаток». Число листов
    // при этом не меняется никогда: оно сравнивается раньше и приоритетнее,
    // меняется только то, КУДА сведён незанятый край.
    const orderings: PartOrdering[] = ["algorithm", "area", "longSide", "height", "width", "perimeter"];
    const selections: SheetSelection[] = ["spread", "fillFirst", "fullestFirst"];
    // мм², целым — иначе на сравнении всплывает погрешность дробных м²
    const emptyBeforeLast = (sheets: Array<{ exactFreeArea: number }>) =>
      sheets.slice(0, -1).reduce((sum, s) => sum + Math.round(s.exactFreeArea * 1_000_000), 0);

    // Один материал и одна толщина: packLayoutByPattern пакует каждую группу
    // отдельно, а сырой packLayout — всё разом, и на смеси их не сравнить.
    const singleGroup = (seed: number) => {
      let s = seed;
      const rnd = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
      return Array.from({ length: 45 }, (_, i) => {
        const [w, h] = SIZES[Math.floor(rnd() * SIZES.length)];
        return createDraftPart({
          id: `p${i}`,
          name: `Деталь ${i + 1}`,
          width: String(w),
          height: String(h),
          quantity: String(1 + Math.floor(rnd() * 3)),
          pattern: "white_gloss",
          thickness: "19",
        });
      });
    };

    for (let seed = 1; seed <= 8; seed += 1) {
      const parts = normalizeDrafts(singleGroup(seed), "white_gloss");
      const settings = base({ algorithm: "leftEdge" });
      const chosen = packLayoutByPattern(parts, settings);

      // те же варианты, среди которых packBestLayout делает выбор
      const candidates: LayoutPackResult[] = [];
      for (const ordering of orderings) {
        for (const selection of selections) {
          for (const allowRotation of [false, true]) {
            candidates.push(packLayout(parts, { ...settings, allowRotation }, ordering, selection));
          }
        }
      }

      // Сравниваем по одной базе: packLayoutByPattern пустые листы из выдачи
      // убирает, сырой packLayout — нет.
      const shown = (c: LayoutPackResult) =>
        c.sheets.filter((sheet) => sheet.placements.length > 0);
      const comparable = candidates.filter(
        (c) =>
          c.stats.unplacedCount === chosen.stats.unplacedCount &&
          shown(c).length === chosen.sheets.length,
      );
      const bestEmpty = Math.min(...comparable.map((c) => emptyBeforeLast(shown(c))));

      expect(emptyBeforeLast(chosen.sheets), `seed ${seed}`).toBe(bestEmpty);
    }
  });

  it("на последнем листе не остаётся детали, которой нашлось бы место раньше", () => {
    // Это и есть смысл уплотнения (compactLastSheet): после основной укладки
    // детали последнего листа перетягиваются на предыдущие, пока влезают.
    // Проверяем результат, а не сам проход: если на последнем листе осталась
    // деталь, которая помещается в остаток любого предыдущего, — уплотнение
    // либо не отработало, либо отработало не до конца.
    const problems: string[] = [];

    for (let seed = 1; seed <= 10; seed += 1) {
      const parts = normalizeDrafts(makeDrafts(seed, 45), "white_gloss");
      const layout = packLayoutByPattern(parts, base({ algorithm: "leftEdge" }));

      for (const group of layout.groups) {
        if (group.sheets.length < 2) {
          continue;
        }
        const last = group.sheets[group.sheets.length - 1];
        const earlier = group.sheets.slice(0, -1);

        for (const placement of last.placements) {
          // в placements лежит уже повёрнутая геометрия — возвращаем исходную
          const part = {
            unitId: placement.unitId,
            sourceId: placement.sourceId,
            sourceNumber: placement.sourceNumber,
            sourceName: placement.sourceName,
            width: placement.rotated ? placement.height : placement.width,
            height: placement.rotated ? placement.width : placement.height,
            preferredSheet: placement.preferredSheet,
            rotate: placement.rotated,
            gapX: placement.gapX,
            gapY: placement.gapY,
            pattern: placement.pattern,
            thickness: placement.thickness,
            article: placement.article,
          };

          for (const sheet of earlier) {
            const fits = pickBestPlacement(sheet.remainders, part, "leftEdge", true);
            if (fits) {
              problems.push(
                `seed ${seed}: деталь #${placement.sourceNumber} лежит на последнем листе ` +
                `${last.globalIndex}, хотя влезает на лист ${sheet.globalIndex}`,
              );
              break;
            }
          }
        }
      }
    }

    expect(problems.slice(0, 10)).toEqual([]);
  });
});
