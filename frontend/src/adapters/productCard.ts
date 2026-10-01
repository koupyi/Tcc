import type { ProductListItem } from "@/types/product";
import type { ProductCardModel } from "@/types/productCard";

const PLACEHOLDER_IMAGE = "/images/product-placeholder.svg";

/**
 * Adapts a real API product-list item into the canonical <ProductCard /> model.
 * This is the single seam between "however the backend shapes a listing" and
 * "however the card renders it" — surfaces should never hand ad-hoc shapes to the card.
 */
export function toProductCardModel(product: ProductListItem): ProductCardModel {
  const basePrice = Number(product.basePrice);
  const representativeVariant = product.variants[0];
  const variantCount = product._count.variants;

  const variantPrice = representativeVariant?.price ? Number(representativeVariant.price) : null;
  const salePrice = product.salePrice ? Number(product.salePrice) : null;
  const effectivePrice = variantPrice ?? salePrice;
  const displaySalePrice = effectivePrice !== null && effectivePrice < basePrice ? effectivePrice : null;

  const primaryImage = product.images[0];

  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    imageUrl: primaryImage?.url || PLACEHOLDER_IMAGE,
    imageAlt: primaryImage?.altText || product.name,
    categoryName: product.category?.name ?? null,
    basePrice,
    salePrice: displaySalePrice,
    // No review/rating system exists in the backend yet — never fabricate stars.
    rating: null,
    reviewCount: 0,
    stockQty: representativeVariant?.stockQty ?? 0,
    variantId: variantCount === 1 ? representativeVariant?.id ?? null : null,
    variantCount,
  };
}
