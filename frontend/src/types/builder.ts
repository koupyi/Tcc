export type BuilderCategory = 'case' | 'pcb' | 'plate' | 'switch' | 'keycap' | 'extra';

export const REQUIRED_BUILDER_CATEGORIES: BuilderCategory[] = ['case', 'pcb', 'plate', 'switch', 'keycap'];

/** A real Product+ProductVariant offered as a choice in a builder step. */
export interface BuilderOption {
  productId: string;
  variantId: string;
  category: BuilderCategory;
  slug: string;
  name: string;
  variantName: string;
  imageUrl: string | null;
  unitPrice: number;
  stockQty: number;
  layout: string | null;
  switchType: string | null;
  specs: Record<string, unknown> | null;
}

export interface BuilderOptionsResponse {
  layouts: string[];
  options: Record<BuilderCategory, BuilderOption[]>;
}

/** What the user has picked for a single-selection step (case/pcb/plate/switch/keycap). */
export interface SelectedBuilderItem {
  productId: string;
  variantId: string;
  name: string;
  variantName: string;
  imageUrl: string | null;
  unitPrice: number;
  stockQty: number;
  quantity: number;
  layout: string | null;
  switchType: string | null;
}

export interface BuilderConfiguration {
  layout: string | null;
  case: SelectedBuilderItem | null;
  pcb: SelectedBuilderItem | null;
  plate: SelectedBuilderItem | null;
  switch: SelectedBuilderItem | null;
  keycap: SelectedBuilderItem | null;
  extras: SelectedBuilderItem[];
}

/** Minimal shape persisted as a draft — never price/stock, only identifiers + quantity. */
export interface BuilderDraft {
  layout: string | null;
  case: { variantId: string } | null;
  pcb: { variantId: string } | null;
  plate: { variantId: string } | null;
  switch: { variantId: string; quantity: number } | null;
  keycap: { variantId: string } | null;
  extras: Array<{ variantId: string; quantity: number }>;
}

export interface ValidatedBuilderItem {
  category: BuilderCategory;
  variantId: string;
  quantity: number;
  valid: boolean;
  reason?: string;
  productId?: string;
  productName?: string;
  variantName?: string;
  unitPrice?: number;
  stockQty?: number;
}

export interface BuilderValidationResult {
  valid: boolean;
  items: ValidatedBuilderItem[];
  missingRequired: BuilderCategory[];
}

export interface BuilderAddToCartResult {
  added: Array<{ category: BuilderCategory; variantId: string; productName: string; quantity: number }>;
  skipped: Array<{ category: BuilderCategory; variantId: string; productName?: string; reason: string }>;
}
