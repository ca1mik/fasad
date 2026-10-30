import { describe, expect, it } from "vitest";

import { planRestoreStep } from "@/lib/keep-scroll";

/**
 * Возврат прокрутки после переключения фильтра.
 *
 * Заказчик: «я скролю, выбираю вкладку, и скролл вверх улетает». Хелпер
 * подгоняет позицию покадрово, пока новый список дорисовывается, — и один раз
 * уже ломался ровно в том случае, ради которого написан: на первом кадре
 * страница ещё схлопнута, прокручивать некуда, и хелпер решал, что дошёл.
 *
 * Браузерным прогоном этот кадр не ловится: в реальном браузере высота почти
 * всегда успевает восстановиться, и ошибка выглядит как «иногда не срабатывает».
 */

const WINDOW = 800;

describe("схлопнутый первый кадр", () => {
  it("не считает дело сделанным, пока страница ещё не выросла", () => {
    // Высота равна окну: прокручивать некуда, цель прижимается к нулю.
    const step = planRestoreStep({
      target: 700,
      height: WINDOW,
      innerHeight: WINDOW,
      lastHeight: 0,
      settled: 0,
      attempts: 1,
    });

    expect(step.scrollTo).toBe(0);
    // Страница выросла с нуля до 800 — значит она ещё дорисовывается.
    expect(step.settled).toBe(0);
    expect(step.giveUp).toBe(false);
  });

  it("на следующем кадре доводит до сохранённой позиции", () => {
    const step = planRestoreStep({
      target: 700,
      height: 3000,
      innerHeight: WINDOW,
      lastHeight: WINDOW,
      settled: 0,
      attempts: 2,
    });

    expect(step.scrollTo).toBe(700);
    expect(step.giveUp).toBe(false);
  });
});

describe("когда пора прекращать", () => {
  it("страница перестала расти — ждать больше нечего", () => {
    let settled = 0;
    let giveUp = false;
    // Три кадра подряд одной высоты: список дорисован.
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const step = planRestoreStep({
        target: 700,
        height: 3000,
        innerHeight: WINDOW,
        lastHeight: 3000,
        settled,
        attempts: attempt,
      });
      settled = step.settled;
      giveUp = step.giveUp;
    }

    expect(giveUp).toBe(true);
  });

  it("растущая страница сбрасывает счётчик ожидания", () => {
    const step = planRestoreStep({
      target: 700,
      height: 3200,
      innerHeight: WINDOW,
      lastHeight: 3000,
      settled: 2,
      attempts: 5,
    });

    expect(step.settled).toBe(0);
    expect(step.giveUp).toBe(false);
  });

  it("сдаётся, когда кадры кончились", () => {
    const step = planRestoreStep({
      target: 700,
      height: 3200,
      innerHeight: WINDOW,
      lastHeight: 3000,
      settled: 0,
      attempts: 30,
    });

    expect(step.giveUp).toBe(true);
  });
});

describe("короткий список после отбора", () => {
  it("прокручивает до конца, а не в пустоту", () => {
    // Отфильтрованный список короче сохранённой позиции: подпрыгивать вверх
    // всё равно не должны, поэтому прижимаемся к последнему достижимому пикселю.
    const step = planRestoreStep({
      target: 700,
      height: 1000,
      innerHeight: WINDOW,
      lastHeight: 1000,
      settled: 0,
      attempts: 1,
    });

    expect(step.scrollTo).toBe(200);
  });
});
