"use client";

import { CuttingLayoutUI } from "@/components/forms/cutting-layout-ui";
import type { FilmCuttingOptions, Lead, Order, PriceItem, ReferenceValues } from "@/types/api";

type Props = {
  options: FilmCuttingOptions;
  priceItems?: PriceItem[];
  referenceValues?: ReferenceValues;
  orderContext?: Order | null;
  leadContext?: Lead | null;
  /** «cutting» (МДФ) или «film» (плёнка) — с чем открыть раскрой. */
  initialWorkKind?: "cutting" | "film";
};

export function FilmCuttingPlanner({
  options,
  priceItems,
  referenceValues,
  orderContext,
  leadContext,
  initialWorkKind,
}: Props) {
  return (
    <CuttingLayoutUI
      options={options}
      priceItems={priceItems}
      referenceValues={referenceValues}
      orderContext={orderContext}
      leadContext={leadContext}
      initialWorkKind={initialWorkKind}
    />
  );
}
