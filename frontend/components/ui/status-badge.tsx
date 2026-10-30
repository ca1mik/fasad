import { Badge } from "@/components/ui/badge";
import { statusLabel, statusTone, type StatusKind, type Tone } from "@/lib/labels";
import { cn } from "@/lib/utils";

const TONE_CLASS: Record<Tone, string> = {
  neutral: "bg-slate-100 text-slate-700",
  info: "bg-sky-100 text-sky-800",
  success: "bg-emerald-100 text-emerald-700",
  warning: "bg-amber-100 text-amber-800",
  danger: "bg-red-100 text-red-700",
};

type Props = {
  kind: StatusKind;
  value: string | null | undefined;
  className?: string;
};

/**
 * Статус русским словом и в своём цвете.
 * До этого «Заблокирован» и «Завершён» выглядели одинаково серыми.
 */
export function StatusBadge({ kind, value, className }: Props) {
  return (
    <Badge className={cn(TONE_CLASS[statusTone(kind, value)], className)}>
      {statusLabel(kind, value)}
    </Badge>
  );
}
