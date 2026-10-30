import { describe, expect, it } from "vitest";

import {
  buildLayoutPatterns,
  layoutGroupKey,
  normalizeDrafts,
  packLayout,
  packLayoutByPattern,
  parseBulkInput,
  parseThickness,
  type CuttingPartDraft,
  type CuttingSheetSettings,
} from "@/lib/cutting-layout";

/**
 * Укладка деталей и арифметика вокруг неё.
 *
 * Браузером эти ошибки не поймать: карта выглядит осмысленной и при неверной
 * раскладке, а занижённая площадь к заказу — просто число, которое менеджер
 * перебивает в заявку поставщику. Здесь проверяем то, что уже ломалось.
 */

/** Лист студии: 2750×1250, поле слева 60 мм, зазор между деталями 60. */
function sheet(overrides: Partial<CuttingSheetSettings> = {}): CuttingSheetSettings {
  return {
    sheetWidth: 2750,
    sheetHeight: 1250,
    marginX: 60,
    marginY: 15,
    marginRight: 15,
    marginBottom: 15,
    defaultGapX: 60,
    defaultGapY: 60,
    algorithm: "leftEdge",
    allowRotation: true,
    keepEdgeGap: true,
    workKind: "cutting",
    ...overrides,
  };
}

function draft(width: string, height: string, quantity = "1"): CuttingPartDraft {
  return {
    id: `d-${width}x${height}-${quantity}`,
    catalogItemCode: "",
    name: "Деталь",
    width,
    height,
    quantity,
    preferredSheet: "",
    rotate: false,
    gapX: "",
    gapY: "",
    pattern: "mat",
    thickness: "",
    article: "",
    milling: "",
  };
}

function layoutOf(drafts: CuttingPartDraft[], settings: CuttingSheetSettings) {
  return packLayoutByPattern(normalizeDrafts(drafts, "mat"), settings);
}

describe("ошибочный ввод раскроя", () => {
  it("не считает деталь размещённой, если поля съели всю рабочую зону", () => {
    const layout = layoutOf([draft("20", "20")], sheet({ sheetWidth: 50 }));

    expect(layout.sheets).toHaveLength(0);
    expect(layout.unplaced).toHaveLength(1);
    expect(layout.stats.placedCount).toBe(0);
    expect(layout.stats.unplacedCount).toBe(1);
  });

  it("не превращает дробное количество в лишние физические детали", () => {
    expect(normalizeDrafts([draft("20", "20", "1.5")], "mat")).toHaveLength(0);
    const bulk = parseBulkInput("20x20x1.5 | Белый глянец | 19", { pattern: "mat" });
    expect(bulk.parts).toHaveLength(0);
    expect(bulk.errors).toHaveLength(1);
  });
});

it("карта распила подписана толщиной МДФ, а цвет остаётся на детали", () => {
  const layout = layoutOf([{ ...draft("400", "300"), thickness: "19" }], sheet());
  const patterns = buildLayoutPatterns(layout.groups, [{
    code: "mat", name: "Белый глянец", finish: "gloss", kind: "solid",
    fill: "#fff", accent: "#fff", stroke: "#000", text: "#000",
  }]);
  const label = patterns.find((pattern) => pattern.code === layout.groups[0].pattern)?.name;
  expect(label).toBe("МДФ, 19 мм");
  expect(layout.sheets[0].placements[0].pattern).toBe("mat");
});

describe("отступ от левого края", () => {
  it("первая деталь встаёт на заданное поле, а не вплотную к кромке", () => {
    // Заказчик: «от края левого всегда 60 мм отступ». Зазор идёт ЗА деталью,
    // поэтому у левой кромки его нет — держит только поле листа.
    const layout = layoutOf([draft("400", "300")], sheet());
    const placement = layout.sheets[0].placements[0];

    expect(placement.x).toBe(60);
  });

  it("поле уменьшает рабочую зону, а не подвигает её молча", () => {
    const layout = layoutOf([draft("400", "300")], sheet());

    // 2750 − 60 слева − 15 справа
    expect(layout.sheets[0].workWidth).toBe(2675);
  });
});

describe("поворот детали", () => {
  const tall = () => draft("400", "1300");

  it("разрешён — деталь, не влезающая по высоте, ложится повёрнутой", () => {
    // 1300 + 60 зазора выше рабочей высоты 1220, но 1300 в ширину проходит.
    const layout = layoutOf([tall()], sheet({ allowRotation: true }));

    expect(layout.stats.unplacedCount).toBe(0);
    expect(layout.sheets[0].placements[0].rotated).toBe(true);
  });

  it("запрещён — такая деталь не размещается вовсе, а не теряется тихо", () => {
    const layout = layoutOf([tall()], sheet({ allowRotation: false }));

    expect(layout.stats.placedCount).toBe(0);
    // Считать её размещённой нельзя: в цехе недосчитались бы фасада.
    expect(layout.stats.unplacedCount).toBe(1);
  });
});

describe("сколько материала уходит с листа", () => {
  // Поворот выключен: иначе укладчик волен положить деталь короткой стороной
  // вдоль листа, и проверяемая арифметика зависела бы от его выбора.
  const fixed = () => sheet({ allowRotation: false });

  it("длина считается до правого края последней детали", () => {
    const layout = layoutOf([draft("400", "300")], fixed());
    const only = layout.sheets[0];

    // Деталь 400 мм плюс её зазор 60 — столько рабочей зоны занято.
    expect(only.usedLength).toBe(460);
  });

  it("свободная полоса справа и занятая длина вместе дают рабочую ширину", () => {
    const layout = layoutOf([draft("400", "300")], fixed());
    const only = layout.sheets[0];

    // На этом равенстве стоит расчёт закупки: длина к заказу считается как
    // «ширина листа минус свободная полоса». Разъедется — недозакажем материал.
    expect(only.usedLength + only.freeStripWidth).toBe(only.workWidth);
  });

  it("физический кусок к заказу шире занятой зоны на поля листа", () => {
    const layout = layoutOf([draft("400", "300")], fixed());
    const only = layout.sheets[0];

    // Именно так считает блок «Что заказать поставщику»: рулон приходит целиком,
    // поля листа с него не сэкономить. Считали по рабочей зоне — занижали, и
    // менеджер перебивал заниженное число в заявку поставщику.
    const cutLength = only.width - only.freeStripWidth;
    const marginRight = only.width - only.marginX - only.workWidth;

    expect(cutLength).toBe(only.marginX + only.usedLength + marginRight);
    expect(cutLength).toBe(60 + 460 + 15);
    // Ширина к заказу — полная ширина материала, а не рабочая зона.
    expect(only.height).toBe(1250);
    expect(only.workHeight).toBe(1220);
  });
});

describe("толщина из того, что ввёл человек", () => {
  it("понимает голое число и запись с единицами", () => {
    expect(parseThickness("19")).toBe(19);
    expect(parseThickness("19мм")).toBe(19);
    expect(parseThickness("19,5")).toBe(19.5);
  });

  it("берёт толщину плиты, а не первое число с «мм»", () => {
    // «паз 4мм под стекло, плита 19мм»: по первому числу карты разъехались бы
    // по толщине 4 мм, которой у плиты нет.
    expect(parseThickness("паз 4мм под стекло, плита 19мм")).toBe(4);
    expect(parseThickness("Эмаль RAL 9003 плита 19мм")).toBe(19);
  });

  it("не принимает номер RAL за миллиметры", () => {
    expect(parseThickness("RAL 9003мм")).toBeNull();
  });
});

describe("что делит карты", () => {
  // Делители у распила и плёнки РАЗНЫЕ, и это не симметрия, а физика:
  // деталь 16 мм из плиты 19 мм не выпилить, а плёнку кладут поверх уже
  // готовых деталей, и толщина основания на её раскрой не влияет.

  describe("распил МДФ — делит только толщина", () => {
    it("разные толщины идут разными картами", () => {
      expect(layoutGroupKey("mat", 16, "cutting")).not.toBe(layoutGroupKey("mat", 19, "cutting"));
    });

    it("разные артикулы одной толщины лежат на ОДНОЙ карте", () => {
      // Раньше артикул делил и здесь, и раскрой дробился в труху: две карты
      // одного материала и одной толщины, каждая заполнена на четверть.
      // Разбирают по пачкам после распила — артикул напечатан на самой детали.
      expect(layoutGroupKey("mat", 19, "cutting", "ART-777")).toBe(
        layoutGroupKey("mat", 19, "cutting", "ART-999"),
      );
    });

    it("разные цвета отделки одной толщины лежат на одной плите МДФ", () => {
      expect(layoutGroupKey("mat", 19, "cutting")).toBe(layoutGroupKey("oak", 19, "cutting"));
    });
  });

  describe("плёнка — делит только артикул", () => {
    it("разные толщины с одним артикулом лежат на ОДНОЙ карте", () => {
      const keys = [11, 12, 14, 15, 16].map((mm) => layoutGroupKey("mat", mm, "film", "ART-777"));
      expect(new Set(keys).size).toBe(1);
    });

    it("разные артикулы идут разными картами", () => {
      expect(layoutGroupKey("mat", 16, "film", "ART-777")).not.toBe(
        layoutGroupKey("mat", 16, "film", "ART-999"),
      );
    });

    it("артикул объединяет плёнку и при разном написании цвета", () => {
      expect(layoutGroupKey("mat", 16, "film", "ART-777")).toBe(
        layoutGroupKey("oak", 16, "film", "ART-777"),
      );
    });
  });

  it("одна партия: на плёнке одна карта, на распиле — по карте на толщину", () => {
    // Сквозная проверка того же правила на настоящей раскладке.
    const drafts = [11, 12, 14, 15, 16].map((mm) => ({
      ...draft("400", "300"),
      id: `d-${mm}`,
      thickness: String(mm),
      article: "ART-777",
    }));

    const film = layoutOf(drafts, sheet({ workKind: "film" }));
    const cutting = layoutOf(drafts, sheet({ workKind: "cutting" }));

    expect(film.groups).toHaveLength(1);
    expect(film.groups[0].thicknesses).toEqual([11, 12, 14, 15, 16]);
    expect(cutting.groups).toHaveLength(5);
  });

  it("на распиле карта не подписывается артикулом одной из деталей", () => {
    // На карте лежат детали разных артикулов — подписать её артикулом первой
    // значило бы соврать про остальные.
    const drafts = ["ART-777", "ART-999"].map((article, index) => ({
      ...draft("400", "300"),
      id: `d-${index}`,
      thickness: "19",
      article,
    }));

    const cutting = layoutOf(drafts, sheet({ workKind: "cutting" }));

    expect(cutting.groups).toHaveLength(1);
    expect(cutting.groups[0].article).toBeNull();
  });

  it("партия смешивает заказы, артикулы и цвета только внутри одинаковой толщины", () => {
    const drafts = [
      { ...draft("400", "300"), id: "a", name: "Заказ 1 · Фасад", pattern: "white", thickness: "19", article: "A" },
      { ...draft("400", "300"), id: "b", name: "Заказ 2 · Фасад", pattern: "black", thickness: "19", article: "B" },
      { ...draft("400", "300"), id: "c", name: "Заказ 3 · Фасад", pattern: "white", thickness: "16", article: "A" },
    ];
    const cutting = layoutOf(drafts, sheet({ workKind: "cutting" }));
    expect(cutting.groups).toHaveLength(2);
    const nineteen = cutting.groups.find((group) => group.thickness === 19);
    expect(nineteen?.sheets.flatMap((item) => item.placements)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sourceName: "Заказ 1 · Фасад", pattern: "white", article: "A" }),
        expect.objectContaining({ sourceName: "Заказ 2 · Фасад", pattern: "black", article: "B" }),
      ]),
    );
    expect(nineteen?.article).toBeNull();

    const film = layoutOf(drafts, sheet({ workKind: "film" }));
    expect(film.groups).toHaveLength(2);
    expect(film.groups.find((group) => group.article === "A")?.sheets.flatMap((item) => item.placements))
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ sourceName: "Заказ 1 · Фасад", thickness: 19 }),
        expect.objectContaining({ sourceName: "Заказ 3 · Фасад", thickness: 16 }),
      ]));
  });
});

describe("разбор строк бланка", () => {
  it("вырожденные строки в раскрой не попадают", () => {
    // Заказчик боится, что «детали улетают». Обратная беда не менее вредна:
    // строка с нулём, минусом или мусором создала бы деталь-невидимку, под
    // которую всё равно заводится карта. Отбиваем на разборе, с объяснением
    // в списке ошибок — молча пропадать ничего не должно.
    const input = [
      "741 344 2 | Белый глянец | 19 |",
      "0 500 2 | Белый глянец | 19 |",
      "500 0 2 | Белый глянец | 19 |",
      "500 500 0 | Белый глянец | 19 |",
      "-300 400 1 | Белый глянец | 19 |",
      "abc def 1 | Белый глянец | 19 |",
      "741 344 2 3 4 | Белый глянец |",
    ].join("\n");

    const result = parseBulkInput(input, { pattern: "mat" });
    const parts = normalizeDrafts(result.parts, "mat");

    expect(parts).toHaveLength(1);
    expect(result.errors).toHaveLength(6);
    for (const part of parts) {
      expect(part.width).toBeGreaterThan(0);
      expect(part.height).toBeGreaterThan(0);
      expect(part.quantity).toBeGreaterThan(0);
    }
  });

  it("маленькая, но настоящая деталь проходит — это не мусор", () => {
    // 4×100 мм выглядит ошибкой бланка, но система не вправе её выбрасывать:
    // такие планки бывают, и решать за технолога нельзя. Если деталь в бланке
    // указана — она обязана оказаться на карте.
    const result = parseBulkInput("4 100 1 | Белый глянец | 19 |", { pattern: "mat" });
    const parts = normalizeDrafts(result.parts, "mat");

    expect(parts).toHaveLength(1);
    expect(parts[0].width).toBe(4);
    expect(result.errors).toHaveLength(0);
  });
});

describe("пустые карты", () => {
  it("деталь крупнее рабочей зоны не рождает карту, на которой ничего нет", () => {
    // Цех получал карту с заполнением 0.0% и пустым листом и не мог понять,
    // потерялась деталь или лист правда пустой. Причина пишется отдельно, в
    // блоке «Не поместилось деталей», а молчащая пустая карта только мешала.
    const layout = layoutOf([draft("9000", "300")], sheet());

    expect(layout.sheets).toHaveLength(0);
    expect(layout.unplaced).toHaveLength(1);
    expect(layout.groups[0].stats.sheetCount).toBe(0);
  });

  it("годная деталь остаётся на карте, даже когда соседняя не влезла", () => {
    const layout = layoutOf([draft("400", "300"), draft("9000", "300")], sheet());

    expect(layout.sheets).toHaveLength(1);
    expect(layout.sheets[0].placements).toHaveLength(1);
    expect(layout.sheets[0].fillPercent).toBeGreaterThan(0);
    expect(layout.unplaced).toHaveLength(1);
  });

  it("явный номер листа не плодит пустые карты перед деталью", () => {
    // Раньше «положить на лист 4» создавало листы 1–3 пустыми, и в полосе карт
    // висели три карты без единой детали.
    const layout = layoutOf([{ ...draft("400", "300"), preferredSheet: "4" }], sheet());

    expect(layout.sheets).toHaveLength(1);
    expect(layout.sheets[0].globalIndex).toBe(1);
    expect(layout.sheets[0].localIndex).toBe(1);
  });

  it("does not allocate empty sheets for an excessive preferred sheet number", () => {
    const layout = layoutOf([{ ...draft("400", "300"), preferredSheet: "1000000000" }], sheet());

    expect(layout.sheets).toHaveLength(1);
    expect(layout.sheets[0].placements).toHaveLength(1);
    expect(layout.sheets[0].localIndex).toBe(1);
  });

  it("ignores a fractional preferred sheet number from raw input", () => {
    const parts = normalizeDrafts([draft("400", "300")], "mat");
    parts[0].preferredSheet = 1.5;

    const layout = packLayout(parts, sheet());
    expect(layout.stats.placedCount).toBe(1);
    expect(layout.sheets[0].placements).toHaveLength(1);
  });

  it("у каждой показанной карты заполнение больше нуля", () => {
    const drafts = [draft("400", "300", "7"), draft("9000", "300"), draft("620", "410", "5")];
    const layout = layoutOf(drafts, sheet());

    expect(layout.sheets.length).toBeGreaterThan(0);
    for (const view of layout.sheets) {
      expect(view.placements.length).toBeGreaterThan(0);
      expect(view.fillPercent).toBeGreaterThan(0);
    }
  });
});
