"use client";

import type { FilmCuttingColorPlan } from "@/types/api";

type Props = {
  plan: FilmCuttingColorPlan;
  rollWidthMm: number;
};

const palette = ["#fbbf24", "#fb7185", "#60a5fa", "#34d399", "#c084fc", "#f97316"];

export function FilmLayoutPreview({ plan, rollWidthMm }: Props) {
  const height = Math.max(plan.estimated_roll_length_mm, 400);
  const viewBox = `0 0 ${rollWidthMm} ${height}`;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.12em] text-slate-500">
        <span>Рулон {rollWidthMm} мм</span>
        <span>Длина {plan.estimated_roll_length_mm} мм</span>
        <span>Отход {plan.waste_percent}%</span>
      </div>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-3">
        <svg viewBox={viewBox} className="h-[300px] w-full rounded-2xl bg-slate-50">
          <rect x="0" y="0" width={rollWidthMm} height={height} fill="#f8fafc" stroke="#cbd5e1" />
          {plan.layout_rows.map((row) => (
            <g key={row.row_index}>
              <line
                x1="0"
                y1={row.y_mm}
                x2={rollWidthMm}
                y2={row.y_mm}
                stroke="#cbd5e1"
                strokeDasharray="10 6"
              />
              {row.items.map((item, index) => {
                const fill = palette[index % palette.length];
                return (
                  <g key={`${item.line_index}-${item.x_mm}-${item.y_mm}`}>
                    <rect
                      x={item.x_mm}
                      y={item.y_mm}
                      width={item.width_mm}
                      height={item.length_mm}
                      rx="14"
                      fill={fill}
                      fillOpacity="0.72"
                      stroke="#0f172a"
                      strokeOpacity="0.18"
                    />
                    <text
                      x={item.x_mm + 18}
                      y={item.y_mm + 28}
                      fontSize="22"
                      fill="#0f172a"
                    >
                      {item.source_name}
                    </text>
                    <text
                      x={item.x_mm + 18}
                      y={item.y_mm + 56}
                      fontSize="18"
                      fill="#334155"
                    >
                      {item.length_mm} x {item.width_mm} мм
                    </text>
                  </g>
                );
              })}
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}
