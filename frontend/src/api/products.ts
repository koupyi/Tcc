import { apiClient, ApiResponse } from './client';

export interface Product {
  id: string;
  name: string;
  slug: string;
  description?: string;
  brand?: string;
  sku?: string;
  basePrice: number;
  salePrice?: number;
  isFeatured: boolean;
  isActive: boolean;
  category?: { id: string; name: string; slug: string };
  images?: Array<{ id: string; url: string; altText?: string; isPrimary: boolean }>;
  variants?: ProductVariant[];
}

export interface ProductVariant {
  id: string;
  name: string;
  sku: string;
  price?: number;
  switchType?: string;
  layout?: string;
  color?: string;
  stockQty: number;
  isActive: boolean;
  images?: Array<{ id: string; url: string; altText?: string }>;
}

export interface ProductListParams {
  page?: string;
  limit?: string;
  search?: string;
  categoryId?: string;
  brand?: string;
  minPrice?: string;
  maxPrice?: string;
  sortBy?: string;
  sortOrder?: string;
  isFeatured?: string;
}

export const productsApi = {
  list(params?: ProductListParams): Promise<ApiResponse<Product[]>> {
    return apiClient.get('/products', params as Record<string, string>);
  },

  getBySlug(slug: string): Promise<ApiResponse<Product>> {
    return apiClient.get(`/products/slug/${slug}`);
  },

  getById(id: string): Promise<ApiResponse<Product>> {
    return apiClient.get(`/products/${id}`);
  },

  /** Real sales-ranked best sellers (OrderItem aggregation) — empty when there's no sales history yet. */
  bestSellers(limit?: number): Promise<ApiResponse<Product[]>> {
    return apiClient.get('/products/best-sellers', limit ? { limit: String(limit) } : undefined);
  },
};
