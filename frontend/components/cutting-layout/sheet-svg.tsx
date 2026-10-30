"use client";

import { SVGAttributes } from "react";

import {
  getPatternByCode,
  type CuttingPattern,
  type LayoutPlacement,
  type LayoutSheetView,
} from "@/lib/cutting-layout";

import { buildSvgPatternId, fallbackPattern, getPlacementLabel } from "./lib";

/**
 * Насколько гаснут соседние детали, когда одну навели мышью.
 *
 * Было 0.22 — это деталь не приглушало, а стирало: поверх штриховки остатка и
 * на ярком мониторе в цеху её просто не видно, и менеджер решал, что деталь
 * потерялась при раскладке. Особенно сбивало с толку то, что на миникарте той
 * же карты подсветки нет вовсе и там все детали оставались на месте.
 */
const MUTED_OPACITY = 0.45;

/**
 * Лежит ли подсвеченная деталь на этой карте.
 *
 * Гасить соседей имеет смысл только тогда. Подсветка приходит и от наведения на
 * строку в списке деталей, а деталь оттуда может лежать на другом листе — и
 * тогда гасились разом ВСЕ детали активной карты, то есть лист выглядел пустым.
 */
export function hasHighlightedPlacement(
  placements: Pick<LayoutPlacement, "sourceId">[],
  highlightedSourceId: string | null,
) {
  return (
    highlightedSourceId !== null &&
    placements.some((placement) => placement.sourceId === highlightedSourceId)
  );
}

function getGridStep(sheet: LayoutSheetView) {
  const largestDimension = Math.max(sheet.width, sheet.height);
  if (largestDimension > 5000) {
    return 1000;
  }
  if (largestDimension > 3000) {
    return 500;
  }
  if (largestDimension > 1500) {
    return 250;
  }
  return 100;
}

function buildSvgPatternProps(pattern: CuttingPattern): SVGAttributes<SVGPatternElement> {
  if (pattern.kind === "diagonal") {
    return {
      width: 24,
      height: 24,
      patternUnits: "userSpaceOnUse",
      patternTransform: "rotate(35)",
    };
  }

  if (pattern.kind === "grid") {
    return {
      width: 18,
      height: 18,
      patternUnits: "userSpaceOnUse",
    };
  }

  if (pattern.kind === "wood") {
    return {
      width: 14,
      height: 24,
      patternUnits: "userSpaceOnUse",
    };
  }

  if (pattern.kind === "dots") {
    return {
      width: 16,
      height: 16,
      patternUnits: "userSpaceOnUse",
    };
  }

  return {
    width: 8,
    height: 8,
    patternUnits: "userSpaceOnUse",
  };
}

function renderPlacementLabel(
  placement: LayoutPlacement,
  compact: boolean,
  materialName?: string,
  orderNumber?: string | null,
) {
  if (compact) {
    if (Math.min(placement.width, placement.height) < 120) {
      return [];
    }
    return [`#${placement.sourceNumber}`];
  }

  return getPlacementLabel({
    sourceNumber: placement.sourceNumber,
    sourceName: placement.sourceName,
    width: placement.width,
    height: placement.height,
    rotated: placement.rotated,
    material: materialName,
    thickness: placement.thickness,
    article: placement.article,
    orderNumber,
  });
}

export function SheetSvg({
  sheet,
  patterns,
  highlightedSourceId,
  onHover,
  onSelectPlacement,
  svgRef,
  compact = false,
  showGrid = true,
  orderNumber = null,
}: {
  sheet: LayoutSheetView;
  patterns: CuttingPattern[];
  highlightedSourceId: string | null;
  onHover: (sourceId: string | null) => void;
  onSelectPlacement?: (sourceId: string) => void;
  svgRef: (element: SVGSVGElement | null) => void;
  compact?: boolean;
  showGrid?: boolean;
  /** Номер заказа или заявки — печатается на каждой детали карты. */
  orderNumber?: string | null;
}) {
  const material = getPatternByCode(patterns, sheet.pattern) ?? fallbackPattern;
  // Карта подписана толщиной или артикулом; на каждой детали оставляем
  // её собственный цвет из сметы, даже когда цвета смешаны на одном листе.
  const gridStep = getGridStep(sheet);
  const highlightOnSheet = hasHighlightedPlacement(sheet.placements, highlightedSourceId);
  const verticalGrid = [];
  const horizontalGrid = [];

  for (let x = 0; x <= sheet.width; x += gridStep) {
    verticalGrid.push(x);
  }

  for (let y = 0; y <= sheet.height; y += gridStep) {
    horizontalGrid.push(y);
  }

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${sheet.width} ${sheet.height}`}
      className="block h-auto w-full bg-white"
      role="img"
      aria-label={`Карта ${sheet.globalIndex} для материала ${material.name}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {patterns.map((pattern) => (
          <pattern
            id={buildSvgPatternId(pattern.code)}
            key={pattern.code}
            {...buildSvgPatternProps(pattern)}
          >
            <rect width="100%" height="100%" fill={pattern.fill} />
            {pattern.kind === "diagonal" ? (
              <>
                <rect x="-12" y="0" width="6" height="24" fill={pattern.accent} opacity="0.65" />
                <rect x="6" y="0" width="6" height="24" fill={pattern.accent} opacity="0.65" />
              </>
            ) : null}
            {pattern.kind === "grid" ? (
              <>
                <path d="M 0 0 H 18" stroke={pattern.accent} strokeWidth="1" />
                <path d="M 0 0 V 18" stroke={pattern.accent} strokeWidth="1" />
              </>
            ) : null}
            {pattern.kind === "wood" ? (
              <>
                <path d="M 0 5 C 4 3, 10 3, 14 5" stroke={pattern.accent} strokeWidth="1.2" />
                <path d="M 0 12 C 4 10, 10 10, 14 12" stroke={pattern.accent} strokeWidth="1.2" />
                <path d="M 0 19 C 4 17, 10 17, 14 19" stroke={pattern.accent} strokeWidth="1.2" />
              </>
            ) : null}
            {pattern.kind === "dots" ? (
              <circle cx="8" cy="8" r="2.4" fill={pattern.accent} opacity="0.75" />
            ) : null}
          </pattern>
        ))}

        <pattern
          id="remainder-hatch"
          width="16"
          height="16"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <rect width="100%" height="100%" fill="#f8fafc" />
          <line x1="0" y1="0" x2="0" y2="16" stroke="#94a3b8" strokeWidth="4" />
        </pattern>
      </defs>

      <rect x="0" y="0" width={sheet.width} height={sheet.height} fill="#f3f4f6" stroke="#111827" strokeWidth="3" />

      {showGrid && !compact
        ? verticalGrid.map((x) => (
            <g key={`vx-${x}`}>
              <line
                x1={x}
                y1={0}
                x2={x}
                y2={sheet.height}
                stroke="#d1d5db"
                strokeDasharray="8 10"
                strokeWidth="1"
                opacity="0.7"
              />
              {x < sheet.width ? (
                <text x={x + 6} y={18} fontSize="14" fill="#64748b">
                  {x}
                </text>
              ) : null}
            </g>
          ))
        : null}

      {showGrid && !compact
        ? horizontalGrid.map((y) => (
            <g key={`hy-${y}`}>
              <line
                x1={0}
                y1={y}
                x2={sheet.width}
                y2={y}
                stroke="#d1d5db"
                strokeDasharray="8 10"
                strokeWidth="1"
                opacity="0.7"
              />
              {y < sheet.height ? (
                <text x={8} y={Math.max(y - 6, 18)} fontSize="14" fill="#64748b">
                  {y}
                </text>
              ) : null}
            </g>
          ))
        : null}

      <rect
        x={sheet.marginX}
        y={sheet.marginY}
        width={sheet.workWidth}
        height={sheet.workHeight}
        fill="#ffffff"
        stroke="#0f172a"
        strokeWidth={compact ? 2.5 : 3.5}
      />

      {sheet.remainders.map((rect, index) => (
        <rect
          key={`rem-${index}`}
          x={rect.x}
          y={rect.y}
          width={rect.width}
          height={rect.height}
          fill="url(#remainder-hatch)"
          stroke="#94a3b8"
          strokeWidth={compact ? 1.4 : 2}
        />
      ))}

      {sheet.placements.map((placement) => {
        const pattern = getPatternByCode(patterns, placement.pattern) ?? fallbackPattern;
        // Гасим соседей только если подсвеченная деталь ЛЕЖИТ на этой карте.
        // Наведение на строку списка деталей подсвечивает деталь с любого листа,
        // и без этой проверки гасились разом ВСЕ детали активной карты — лист
        // выглядел пустым. Особенно сбивало с толку то, что на миникарте рядом
        // подсветки нет вовсе, и там те же детали оставались видны.
        const isMuted =
          highlightOnSheet && highlightedSourceId !== placement.sourceId;
        // На детали печатаем чистый цвет: толщина и артикул идут своими
        // строками, а в названии карты они уже приписаны к материалу.
        const labelLines = renderPlacementLabel(
          placement,
          compact,
          pattern.name,
          orderNumber,
        );
        const fontSize = compact
          ? Math.max(13, Math.min(24, Math.min(placement.width, placement.height) * 0.1))
          : Math.max(15, Math.min(30, Math.min(placement.width, placement.height) * 0.1));
        const labelX = placement.x + placement.width / 2;
        const labelStartY = placement.y + placement.height / 2 - ((labelLines.length - 1) * fontSize * 0.6) / 2;

        return (
          <g
            key={placement.unitId}
            className={onSelectPlacement ? "cursor-pointer" : undefined}
            opacity={isMuted ? MUTED_OPACITY : 1}
            onMouseEnter={() => onHover(placement.sourceId)}
            onMouseLeave={() => onHover(null)}
            onClick={() => onSelectPlacement?.(placement.sourceId)}
          >
            <title>{[
              placement.sourceName,
              `${placement.width} × ${placement.height} мм`,
              placement.thickness === null ? "" : `${placement.thickness} мм МДФ`,
              placement.article ? `Артикул ${placement.article}` : "",
              pattern.name,
            ].filter(Boolean).join(" · ")}</title>
            <rect
              x={placement.x}
              y={placement.y}
              width={placement.footprintWidth}
              height={placement.footprintHeight}
              fill="#fef3c7"
              opacity="0.45"
              stroke="#f59e0b"
              strokeDasharray={compact ? "5 5" : "8 6"}
              strokeWidth={compact ? 1.2 : 1.6}
            />
            <rect
              x={placement.x}
              y={placement.y}
              width={placement.width}
              height={placement.height}
              fill={`url(#${buildSvgPatternId(pattern.code)})`}
              stroke="#2563eb"
              strokeWidth={compact ? 1.8 : 2.4}
            />
            {labelLines.length ? (
              <text
                x={labelX}
                y={labelStartY}
                fill={pattern.text}
                fontSize={fontSize}
                fontWeight="600"
                textAnchor="middle"
                pointerEvents="none"
              >
                {labelLines.map((line, index) => (
                  <tspan
                    x={labelX}
                    dy={index === 0 ? 0 : fontSize * 0.95}
                    key={`${placement.unitId}-${line}`}
                  >
                    {line}
                  </tspan>
                ))}
              </text>
            ) : null}
          </g>
        );
      })}

      {!compact ? (
        <>
          <text x={sheet.width / 2} y={18} fontSize="16" fill="#111827" textAnchor="middle">
            {Math.round(sheet.width)} мм
          </text>
          <text
            x={18}
            y={sheet.height / 2}
            fontSize="16"
            fill="#111827"
            textAnchor="middle"
            transform={`rotate(-90 18 ${sheet.height / 2})`}
          >
            {Math.round(sheet.height)} мм
          </text>
          <text x={sheet.width - 16} y={20} fontSize="14" fill="#475569" textAnchor="end">
            Карта {sheet.globalIndex} · {material.name}
          </text>
        </>
      ) : null}
    </svg>
  );
}
