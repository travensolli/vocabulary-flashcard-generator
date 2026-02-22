import { describe, expect, it } from "vitest";
import { parseItems, DEFAULT_MAX_ITEMS } from "../utils/items";

describe("parseItems", () => {
  it("trims items and drops empties", () => {
    const items = parseItems(" apple , , banana ,, ");
    expect(items).toEqual(["apple", "banana"]);
  });

  it("deduplicates case-insensitively", () => {
    const items = parseItems("Apple, apple, APPLE, Banana");
    expect(items).toEqual(["Apple", "Banana"]);
  });

  it("respects the max items cap", () => {
    const items = parseItems(Array.from({ length: 30 }, (_, i) => `item${i}`).join(","), 5);
    expect(items).toHaveLength(5);
  });

  it("returns empty array for blank input", () => {
    expect(parseItems("   ")).toEqual([]);
  });

  it("uses DEFAULT_MAX_ITEMS when not provided", () => {
    const items = parseItems(Array.from({ length: DEFAULT_MAX_ITEMS + 5 }, (_, i) => `term${i}`).join(","));
    expect(items).toHaveLength(DEFAULT_MAX_ITEMS);
  });
});
