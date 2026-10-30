"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect } from "react";

/**
 * Держит прокрутку при переключении фильтров.
 *
 * Заказчик: «я скролю, выбираю вкладку, и скролл вверх улетает». Одного
 * `scroll={false}` у ссылки не хватает: страницы собираются на сервере, при
 * переходе содержимое подменяется целиком, высота документа на миг схлопывается
 * — и браузер сбрасывает позицию сам, ещё до того, как новый список отрисуется.
 *
 * Поэтому запоминаем позицию в момент нажатия и возвращаем её, когда новый
 * список уже на месте. Храним в sessionStorage: переход между серверными
 * страницами не сохраняет состояние в памяти.
 */
const KEY_PREFIX = "keep-scroll:";

/** Дальше ждать нечего: примерно полсекунды кадров. Список либо пришёл, либо не придёт. */
const MAX_FRAMES = 30;

/** Сколько кадров подряд высота не растёт, чтобы считать страницу дорисованной. */
const SETTLED_FRAMES = 3;

/** Попали, если промах меньше этого — плавающая высота карточек даёт пару пикселей. */
const HIT_TOLERANCE = 4;

function forget(key: string) {
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // приватный режим или запрет на хранилище — тогда просто без восстановления
  }
}

/** Запомнить текущую позицию перед переходом по фильтру. */
export function rememberScroll(path: string) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(KEY_PREFIX + path, String(Math.round(window.scrollY)));
  } catch {
    // приватный режим или запрет на хранилище — тогда просто без восстановления
  }
}

/**
 * Один кадр подгонки: куда прокрутить и пора ли прекращать.
 *
 * Вынесено отдельной функцией, потому что это единственное место хелпера, где
 * решение можно проверить без браузера, — а ошибка здесь уже была, и ровно в
 * том случае, ради которого хелпер написан. На первом кадре страница ещё
 * схлопнута: прокручивать некуда, окно остаётся в нуле. Пока «дошли» считали по
 * прижатой к концу страницы цели, ноль совпадал с нулём, хелпер решал, что
 * добрался, и стирал сохранённую позицию.
 *
 * Здесь `giveUp` про другое — про то, что ждать больше нечего: страница
 * перестала расти либо кадры кончились.
 */
export function planRestoreStep(state: {
  target: number;
  height: number;
  innerHeight: number;
  lastHeight: number;
  settled: number;
  attempts: number;
}): { scrollTo: number; settled: number; giveUp: boolean } {
  // Отфильтрованный список короче — тогда прокручиваем до конца, а не в
  // пустоту: подпрыгивать вверх всё равно не должны.
  const reachable = Math.max(0, state.height - state.innerHeight);
  // Список ещё дорисовывается, пока страница растёт. Перестала расти — значит
  // это её настоящая высота, и выше цели нам уже не подняться.
  const settled = state.height > state.lastHeight ? 0 : state.settled + 1;
  return {
    scrollTo: Math.min(state.target, reachable),
    settled,
    giveUp: settled >= SETTLED_FRAMES || state.attempts >= MAX_FRAMES,
  };
}

/**
 * Вернуть позицию после перехода.
 *
 * `path` по умолчанию — текущий адрес: фильтр меняет только параметры запроса,
 * а сохраняли мы по пути. Явный аргумент нужен там, где страница живёт не по
 * своему `pathname` (например, отчёт с базовым путём из пропсов).
 */
export function useRestoreScroll(path?: string) {
  const pathname = usePathname();
  const key = KEY_PREFIX + (path ?? pathname);
  // Фильтр меняет только параметры запроса, путь остаётся тем же. Без этой
  // зависимости эффект после перехода не срабатывал вовсе — и позиция, честно
  // сохранённая при нажатии, никогда не возвращалась.
  const query = useSearchParams().toString();

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = window.sessionStorage.getItem(key);
    } catch {
      return;
    }
    if (!stored) return;

    const target = Number(stored);
    if (!Number.isFinite(target) || target <= 0) {
      forget(key);
      return;
    }

    let attempts = 0;
    let settled = 0;
    let lastHeight = 0;
    let frame = 0;

    const restore = () => {
      attempts += 1;

      const height = document.documentElement.scrollHeight;
      const step = planRestoreStep({
        target,
        height,
        innerHeight: window.innerHeight,
        lastHeight,
        settled,
        attempts,
      });
      window.scrollTo({ top: step.scrollTo, behavior: "instant" });

      settled = step.settled;
      lastHeight = height;

      // «Дошли» считаем по настоящей позиции окна, а не по вычисленной цели:
      // прижатая к концу страницы цель на схлопнутом кадре равна нулю, и ноль
      // совпал бы с нулём.
      const arrived = Math.abs(window.scrollY - target) < HIT_TOLERANCE;
      if (arrived || step.giveUp) {
        forget(key);
        return;
      }
      frame = window.requestAnimationFrame(restore);
    };

    frame = window.requestAnimationFrame(restore);
    // Уход со страницы посреди подгонки: кадр без этого продолжал бы дёргать
    // прокрутку уже на следующем экране.
    return () => window.cancelAnimationFrame(frame);
  }, [key, query]);
}

/**
 * Прокрутка на месте — одной строкой.
 *
 * `const keepScroll = useKeepScroll()` в компоненте фильтра и `onClick={keepScroll}`
 * на ссылке: восстановление подключается тем же вызовом, забыть половину пары
 * уже нельзя. Раньше `rememberScroll` и `useRestoreScroll` подключались по
 * отдельности и легко расходились — второй ключ брался из адреса, первый
 * писался руками.
 */
export function useKeepScroll(path?: string) {
  const pathname = usePathname();
  const key = path ?? pathname;
  useRestoreScroll(key);
  return useCallback(() => rememberScroll(key), [key]);
}
