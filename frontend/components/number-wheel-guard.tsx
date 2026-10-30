"use client";

import { useEffect } from "react";

/**
 * Колесо мыши не должно менять числа в полях.
 *
 * У сфокусированного `<input type="number">` браузер крутит значение колесом.
 * Менеджер набирал размер детали, прокручивал список дальше — и размер молча
 * уезжал: ни нажатой клавиши, ни подсветки, заметить можно только по итоговой
 * площади. В миллиметрах и рублях счётчик колесом не нужен вовсе.
 *
 * Слушатель один на всё приложение, а не по полю: таких полей два десятка —
 * лист, отступы, зазоры, количество, цены, — и обойти каждое значило бы
 * пропустить следующее, которое кто-нибудь добавит.
 *
 * Снимаем фокус, а не гасим событие: страница обязана прокручиваться дальше,
 * просто уже не над «живым» полем. `passive: true` — мы ничего не отменяем.
 */
export function NumberWheelGuard() {
  useEffect(() => {
    const onWheel = () => {
      const active = document.activeElement;
      if (active instanceof HTMLInputElement && active.type === "number") {
        active.blur();
      }
    };
    document.addEventListener("wheel", onWheel, { passive: true });
    return () => document.removeEventListener("wheel", onWheel);
  }, []);

  return null;
}
