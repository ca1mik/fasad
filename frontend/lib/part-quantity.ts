export const MAX_PART_UNITS = 10_000;

export function positivePartQuantity(value: string): number {
  const parsed = Number(value.replace(",", ".").trim());
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 0;
}

export function invalidPartQuantity(value: string): boolean {
  return value.trim() !== "" && positivePartQuantity(value) === 0;
}
