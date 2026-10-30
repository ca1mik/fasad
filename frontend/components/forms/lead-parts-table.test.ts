import { describe, expect, it } from "vitest";

import { applyRowPatch, createLeadPartRow } from "@/components/forms/lead-parts-table";

/**
 * Пустая строка снизу таблицы расчёта.
 *
 * Заказчик: «я говорила, например, 1, 2, третья позиция, всё, я их заполнила. И
 * когда я начинаю вдруг вносить редактирование, какое-то там количество изменяю
 * или размер, у меня снова вылезает лишняя строка. Мне её приходится удалять
 * каждый раз».
 *
 * Браузером это ловится плохо: лишняя строка выглядит как обычная заготовка, и
 * заметна только тому, кто набирает заказ на сорок позиций.
 */

/** Заполненная строка: длина, ширина и количество — этого хватает для позиции. */
function filled(id: string) {
  return createLeadPartRow({ id, length: "716", width: "396", quantity: "2" });
}

function blank(id: string) {
  return createLeadPartRow({ id });
}

describe("правка строки таблицы", () => {
  it("добавляет пустую строку, когда последняя ТОЛЬКО ЧТО стала заполненной", () => {
    // Ради этого правило и написано: менеджер набирает список подряд и не
    // должен тянуться мышью к кнопке под таблицей.
    const rows = [filled("a"), blank("b")];

    const next = applyRowPatch(rows, "b", { length: "600", width: "400", quantity: "1" });

    expect(next).toHaveLength(3);
    expect(next[2].length).toBe("");
  });

  it("не плодит строку при правке уже заполненной последней", () => {
    // Это и есть жалоба: «снова вылезает лишняя строка».
    const rows = [filled("a"), filled("b")];

    const next = applyRowPatch(rows, "b", { quantity: "5" });

    expect(next).toHaveLength(2);
    expect(next[1].quantity).toBe("5");
  });

  it("не плодит строку при правке середины списка", () => {
    const rows = [filled("a"), filled("b"), filled("c")];

    const next = applyRowPatch(rows, "b", { width: "500" });

    expect(next).toHaveLength(3);
  });

  it("не плодит строку после вставки списком", () => {
    // После «вставить списком» и после загрузки бланка последняя строка уже
    // заполнена — правило на состояние здесь и ломалось.
    const rows = [filled("a"), filled("b"), filled("c")];

    const afterFirstEdit = applyRowPatch(rows, "c", { quantity: "3" });
    const afterSecondEdit = applyRowPatch(afterFirstEdit, "c", { quantity: "4" });

    expect(afterSecondEdit).toHaveLength(3);
  });

  it("не считает строку заполненной, пока не введены все три поля", () => {
    const rows = [blank("a")];

    const onlyLength = applyRowPatch(rows, "a", { length: "716" });
    expect(onlyLength).toHaveLength(1);

    const withWidth = applyRowPatch(onlyLength, "a", { width: "396" });
    expect(withWidth).toHaveLength(1);

    // Количество — последнее недостающее поле, вот теперь строка появится.
    const withQuantity = applyRowPatch(withWidth, "a", { quantity: "2" });
    expect(withQuantity).toHaveLength(2);
  });

  it("правка соседних граф заполненной строки ничего не добавляет", () => {
    const rows = [filled("a")];

    const withColour = applyRowPatch(rows, "a", { color: "RAL 9003" });
    const withArticle = applyRowPatch(withColour, "a", { articleText: "128" });

    expect(withArticle).toHaveLength(1);
    expect(withArticle[0].articleText).toBe("128");
  });
});
