import { describe, expect, it } from "vitest";

import { parseSizeLines } from "@/lib/format";
import { positivePartQuantity } from "@/lib/part-quantity";

describe("quantity of physical parts", () => {
  it("accepts positive safe integers without rounding", () => {
    expect(positivePartQuantity("12")).toBe(12);
    expect(positivePartQuantity("1,5")).toBe(0);
    expect(positivePartQuantity("0.4")).toBe(0);
    expect(positivePartQuantity("9007199254740992")).toBe(0);
  });

  it("rejects fractional and unsafe quantities in pasted size lines", () => {
    const parsed = parseSizeLines("600 400 2\n600 400 1.5\n600 400 9999999999999999");
    expect(parsed.lines).toHaveLength(1);
    expect(parsed.lines[0].quantity).toBe(2);
    expect(parsed.errors.map((error) => error.line)).toEqual([2, 3]);
  });
});
