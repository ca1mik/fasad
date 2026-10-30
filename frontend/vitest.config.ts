import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * Тесты чистой логики фронтенда.
 *
 * Вёрстка и поведение страниц проверяются прогоном в настоящем браузере — там
 * видно то, чего юнит-тест не покажет: съехавшую колонку, выезд страницы вбок,
 * пустую карту раскроя. Здесь другое: арифметика и разбор текста, которые
 * браузером как раз не поймать, потому что на экране они выглядят правдоподобно
 * при неверном результате.
 *
 * Среда — node, без jsdom: всё покрытое ниже к DOM не обращается. Появятся
 * тесты компонентов — тогда и ставить jsdom с testing-library, а не заранее.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts", "components/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
});
