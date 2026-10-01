import { apiClient, ApiResponse } from './client';

export interface Order {
  id: string;
  orderNumber: string;
  status: string;
  subtotal: number;
  shippingCost: number;
  total: number;
  notes?: string;
  items: Array<{
    id: string;
    productName: string;
    variantName: string;
    sku: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
  payment?: {
    status: string;
    method: string;
  };
  createdAt: string;
}

export interface OrderListParams {
  page?: string;
  limit?: string;
  status?: string;
}

export const ordersApi = {
  getMyOrders(params?: OrderListParams): Promise<ApiResponse<Order[]>> {
    return apiClient.get('/orders/my', params as Record<string, string>);
  },

  getById(id: string): Promise<ApiResponse<Order>> {
    return apiClient.get(`/orders/${id}`);
  },

  create(addressId: string, paymentMethod: string, shippingOptionCode?: string, notes?: string): Promise<ApiResponse<Order>> {
    return apiClient.post('/orders', { addressId, paymentMethod, shippingOptionCode, notes });
  },
};
