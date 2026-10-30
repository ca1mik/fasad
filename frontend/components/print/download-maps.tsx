"use client";

import { Download, FileImage, Loader2 } from "lucide-react";
import { useState } from "react";

/**
 * Скачивание карт раскроя файлами.
 *
 * PDF собирается прямо в браузере: каждая карта — уже готовая страница A4 в
 * SVG, её достаточно отрисовать в растр и положить на лист. Кириллицу при этом
 * рисует системный шрифт, поэтому в PDF не нужно вшивать свой — иначе пришлось
 * бы тащить в проект файл шрифта ради одной кнопки.
 *
 * Рядом лежит выгрузка в SVG: она векторная, открывается в браузере и в любом
 * редакторе, и весит килобайты.
 */

/**
 * Разрешение растра, точек на дюйм.
 *
 * 150 — типографский минимум для чертежа: линии и цифры на бумаге читаются, а
 * файл остаётся в разумных мегабайтах. На 200 шесть карт весили 66 МБ, потому
 * что jsPDF без явного сжатия кладёт картинку в PDF как есть.
 */
const DPI = 150;
const MM_PER_INCH = 25.4;
const A4 = { width: 210, height: 297 };

function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function collectPages(): SVGSVGElement[] {
  return [...document.querySelectorAll<SVGSVGElement>("svg.map-page")];
}

/** Готовый к отрисовке XML: без него шрифты и разметка теряются вне документа. */
function serialize(svg: SVGSVGElement) {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", `${A4.width}mm`);
  clone.setAttribute("height", `${A4.height}mm`);
  return new XMLSerializer().serializeToString(clone);
}

function rasterize(svg: SVGSVGElement): Promise<HTMLCanvasElement> {
  const source = serialize(svg);
  const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = Math.round((A4.width / MM_PER_INCH) * DPI);
      canvas.height = Math.round((A4.height / MM_PER_INCH) * DPI);
      const context = canvas.getContext("2d");
      if (!context) {
        URL.revokeObjectURL(url);
        reject(new Error("Браузер не дал холст для отрисовки"));
        return;
      }
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Не удалось отрисовать карту"));
    };
    image.src = url;
  });
}

export function DownloadMaps({ baseName }: { baseName: string }) {
  const [busy, setBusy] = useState<"pdf" | "svg" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function downloadPdf() {
    setBusy("pdf");
    setError(null);
    try {
      const pages = collectPages();
      if (!pages.length) {
        throw new Error("На странице нет ни одной карты");
      }

      // грузим по требованию: библиотека нужна только при нажатии на кнопку
      const { jsPDF } = await import("jspdf");
      // compress обязателен: без него страница уезжает в PDF несжатым растром
      const pdf = new jsPDF({
        unit: "mm",
        format: "a4",
        orientation: "portrait",
        compress: true,
      });

      for (let index = 0; index < pages.length; index += 1) {
        const canvas = await rasterize(pages[index]);
        if (index > 0) {
          pdf.addPage();
        }
        pdf.addImage(
          canvas.toDataURL("image/png"),
          "PNG",
          0,
          0,
          A4.width,
          A4.height,
          undefined,
          "FAST",
        );
      }

      pdf.save(`${baseName}.pdf`);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Не удалось собрать PDF");
    } finally {
      setBusy(null);
    }
  }

  function downloadSvg() {
    setBusy("svg");
    setError(null);
    try {
      const pages = collectPages();
      if (!pages.length) {
        throw new Error("На странице нет ни одной карты");
      }
      pages.forEach((page, index) => {
        const blob = new Blob([serialize(page)], { type: "image/svg+xml;charset=utf-8" });
        saveBlob(blob, `${baseName} — лист ${index + 1}.svg`);
      });
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Не удалось сохранить SVG");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="print-hidden flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={downloadPdf}
        disabled={busy !== null}
        className="inline-flex h-10 items-center rounded-2xl border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:border-slate-400 disabled:opacity-60"
      >
        {busy === "pdf" ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Download className="mr-2 h-4 w-4" />
        )}
        Скачать PDF
      </button>
      <button
        type="button"
        onClick={downloadSvg}
        disabled={busy !== null}
        className="inline-flex h-10 items-center rounded-2xl border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:border-slate-400 disabled:opacity-60"
      >
        <FileImage className="mr-2 h-4 w-4" />
        Скачать SVG
      </button>
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </div>
  );
}
