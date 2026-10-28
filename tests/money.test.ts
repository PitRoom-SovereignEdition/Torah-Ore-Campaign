import { describe, expect, it } from "vitest";
import { convertCents, formatMoney, initialsOf, parseAmountToCents } from "@/lib/money";

describe("money", () => {
  it("parses typed amounts", () => {
    expect(parseAmountToCents("1,800")).toBe(180000);
    expect(parseAmountToCents("36.5")).toBe(3650);
    expect(parseAmountToCents("$18")).toBe(1800);
    expect(parseAmountToCents("-5")).toBeNull();
    expect(parseAmountToCents("1.234")).toBeNull();
    expect(parseAmountToCents("abc")).toBeNull();
  });
  it("converts and formats", () => {
    expect(convertCents(10000, 1.3)).toBe(13000);
    expect(formatMoney(305921_00, "USD")).toBe("$305,921");
    expect(formatMoney(1850, "USD")).toBe("$18.50");
  });
  it("makes initials", () => {
    expect(initialsOf("Moshe Cohen")).toBe("MC");
    expect(initialsOf("  ")).toBe("?");
  });
});
