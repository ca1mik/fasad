import { describe, expect, it } from "vitest";

import { hasHighlightedPlacement } from "@/components/cutting-layout/sheet-svg";

/**
 * Подсветка детали на карте раскроя.
 *
 * Заказчик: «есть отображение деталей на миникарте, хотя на самой карте их
 * нет». Причина была не в раскладке, а здесь: наведение гасило все остальные
 * детали, а миникарта подсветку не получает вовсе — и рядом стояли две картинки
 * одного и того же листа с разным содержимым. Хуже всего был случай, когда
 * подсвеченной детали на карте нет совсем: гасились ВСЕ детали разом.
 */

function placements(...ids: string[]) {
  return ids.map((sourceId) => ({ sourceId }));
}

describe("подсветка детали на карте", () => {
  it("без подсветки ничего не гасим", () => {
    expect(hasHighlightedPlacement(placements("a", "b"), null)).toBe(false);
  });

  it("подсвеченная деталь на этой карте — гасим соседей", () => {
    expect(hasHighlightedPlacement(placements("a", "b"), "b")).toBe(true);
  });

  it("подсвеченная деталь на ДРУГОМ листе — не гасим ничего", () => {
    // Иначе активная карта уходила в прозрачность целиком и читалась как пустая.
    expect(hasHighlightedPlacement(placements("a", "b"), "z")).toBe(false);
  });

  it("на пустой карте гасить нечего", () => {
    expect(hasHighlightedPlacement([], "a")).toBe(false);
  });
});
