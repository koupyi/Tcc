/**
 * Physical keyboard-layout facts (key counts) — not commercial data, just
 * standard industry key counts per layout, used only to compute how many
 * switch packs a build needs. Independent of catalog pricing/stock.
 */
const KEY_COUNT_BY_LAYOUT: Record<string, number> = {
  "60": 61,
  "65": 68,
  "75": 84,
  tkl: 87,
  full: 104,
};

export function keyCountForLayout(layout: string | null): number | null {
  if (!layout) return null;
  return KEY_COUNT_BY_LAYOUT[layout] ?? null;
}

export function layoutLabel(layout: string): string {
  if (layout === "tkl") return "TKL";
  if (layout === "full") return "Full";
  return `${layout}%`;
}

/**
 * Number of packs needed to cover a layout, given the product's real
 * `specs.packSize`. Falls back to a quantity of 1 (individual unit) when the
 * catalog doesn't declare a pack size — never invents a pack size.
 */
export function computeSwitchQuantity(layout: string | null, specs: Record<string, unknown> | null): number {
  const packSize = specs && typeof specs.packSize === "number" ? specs.packSize : null;
  const keyCount = keyCountForLayout(layout);
  if (!packSize || !keyCount) return 1;
  return Math.ceil(keyCount / packSize);
}
