import { apiClient, ApiResponse } from './client';

export interface CartItem {
  id: string;
  variantId: string;
  quantity: number;
  unitPrice: number;
  variant: {
    id: string;
    name: string;
    sku: string;
    product: {
      id: string;
      name: string;
      slug: string;
      images?: Array<{ url: string }>;
    };
    images?: Array<{ url: string }>;
  };
}

export interface Cart {
  id: string;
  items: CartItem[];
  subtotal: number;
  itemCount: number;
}

export const cartApi = {
  get(): Promise<ApiResponse<Cart>> {
    return apiClient.get('/cart');
  },

  addItem(variantId: string, quantity: number): Promise<ApiResponse<Cart>> {
    return apiClient.post('/cart/items', { variantId, quantity });
  },

  updateItem(itemId: string, quantity: number): Promise<ApiResponse<Cart>> {
    return apiClient.patch(`/cart/items/${itemId}`, { quantity });
  },

  removeItem(itemId: string): Promise<ApiResponse<Cart>> {
    return apiClient.delete(`/cart/items/${itemId}`);
  },

  clear(): Promise<ApiResponse<null>> {
    return apiClient.delete('/cart');
  },

  merge(items: Array<{ variantId: string; quantity: number }>): Promise<ApiResponse<Cart>> {
    return apiClient.post('/cart/merge', { items });
  },
};
