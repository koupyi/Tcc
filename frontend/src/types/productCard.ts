/**
 * Canonical view model consumed by <ProductCard />.
 * Every commercial surface (catalog, featured, best-sellers, search, related)
 * must adapt its data into this shape instead of inventing its own card markup.
 */
export interface ProductCardModel {
  id: string;
  slug: string;
  name: string;
  imageUrl: string | null;
  imageAlt: string;
  categoryName: string | null;
  basePrice: number;
  /** Present only when strictly lower than basePrice — drives the strikethrough in <PriceDisplay />. */
  salePrice: number | null;
  /** Real average rating, or null when no review system/data exists yet — never fabricated. */
  rating: number | null;
  reviewCount: number;
  stockQty: number;
  /** Set only when the product has exactly one purchasable variant — safe to buy directly. */
  variantId: string | null;
  variantCount: number;
}
