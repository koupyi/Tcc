/**
 * Tipos do catálogo de produtos — baseados nos contratos validados da API.
 * GET /api/v1/products e GET /api/v1/products/slug/:slug
 */

export interface ProductImage {
  id: string;
  url: string;
  altText: string | null;
  isPrimary: boolean;
  sortOrder: number;
}

export interface ProductVariant {
  id: string;
  name: string;
  sku: string;
  price: number | null;
  stockQty: number;
  isActive: boolean;
  switchType: string | null;
  layout: string | null;
  color: string | null;
  backlight: string | null;
  connectivity: string | null;
  weight: number | null;
  images: ProductImage[];
}

export interface ProductCategory {
  id: string;
  name: string;
  slug: string;
}

/** Produto completo retornado por GET /products/slug/:slug */
export interface ProductDetail {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  brand: string | null;
  sku: string | null;
  basePrice: number;
  salePrice: number | null;
  isFeatured: boolean;
  isActive: boolean;
  tags: string | null;
  specs: Record<string, unknown> | null;
  categoryId: string;
  category: ProductCategory;
  images: ProductImage[];
  variants: ProductVariant[];
}

/** Variante resumida no listing (GET /products) */
export interface ProductVariantSummary {
  id: string;
  name: string;
  sku: string;
  price: string | null;
  stockQty: number;
}

/** Produto no listing (GET /products) — basePrice é string (Decimal) */
export interface ProductListItem {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  brand: string | null;
  sku: string | null;
  basePrice: string;
  salePrice: string | null;
  isFeatured: boolean;
  isActive: boolean;
  tags: string | null;
  specs: Record<string, unknown> | null;
  categoryId: string;
  category: ProductCategory;
  images: ProductImage[];
  variants: ProductVariantSummary[];
  _count: { variants: number };
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface ProductListParams {
  page?: number;
  limit?: number;
  search?: string;
  categoryId?: string;
  brand?: string;
  minPrice?: string;
  maxPrice?: string;
  sortBy?: string;
  sortOrder?: string;
}
