import type { Metadata } from "next";
import { IBM_Plex_Mono, Manrope } from "next/font/google";
import type { ReactNode } from "react";

import { NumberWheelGuard } from "@/components/number-wheel-guard";
import { Providers } from "@/components/providers";

import "./globals.css";

const manrope = Manrope({
  subsets: ["latin", "cyrillic"],
  variable: "--font-sans",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "Управление фасадным производством",
  description: "Заявки, заказы, раскрой, материалы и цех для производства фасадов",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="ru" className={`${manrope.variable} ${plexMono.variable}`}>
      <body className="font-[var(--font-sans)]">
        {/* Один сторож на всё приложение: колесо мыши не крутит числа в полях. */}
        <NumberWheelGuard />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
