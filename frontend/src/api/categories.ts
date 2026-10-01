import { apiClient, ApiResponse } from './client';

export interface Category {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  _count: { products: number };
}

export const categoriesApi = {
  list(): Promise<ApiResponse<Category[]>> {
    return apiClient.get('/categories');
  },

  getBySlug(slug: string): Promise<ApiResponse<Category>> {
    return apiClient.get(`/categories/slug/${slug}`);
  },
};
