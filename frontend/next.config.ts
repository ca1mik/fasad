import type { NextConfig } from "next";

/**
 * Бэкенд, к которому фронт ходит с сервера и через прокси.
 *
 * По умолчанию — локальный. В докере и на сервере задаётся переменной.
 */
const backendOrigin = process.env.BACKEND_ORIGIN || "http://127.0.0.1:8000";

const nextConfig: NextConfig = {
  // Автономная сборка: .next/standalone несёт свой минимальный node_modules и
  // запускается одним `node server.js`, без npm install и без Node.js
  // рантайма из системы — нужен только сам node.exe рядом (см.
  // docs/portable-usb.md). На `next dev` эта настройка не влияет — только на
  // `next build`, так что живому dev-серверу это ничем не грозит.
  output: "standalone",
  async rewrites() {
    return [
      // Прокси на бэкенд с того же адреса, что и фронт.
      //
      // Нужен для показа через туннель: браузер клиента открывает публичный
      // адрес и оттуда же обращается к API. Без прокси пришлось бы поднимать
      // второй туннель и вписывать его адрес в NEXT_PUBLIC_API_URL.
      {
        source: "/api/v1/:path*",
        destination: `${backendOrigin}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
