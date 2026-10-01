import { apiClient, ApiResponse } from './client';

export interface ShippingOption {
  id: string;
  code: string;
  name: string;
  carrier: string;
  price: number;
  days: number;
  description: string;
}

export const shippingApi = {
  calculate(zipCode: string): Promise<ApiResponse<ShippingOption[]>> {
    return apiClient.post('/shipping/calculate', { zipCode });
  },

  getOrderShipping(orderId: string): Promise<ApiResponse<{
    id: string;
    status: string;
    carrier: string | null;
    serviceName: string | null;
    serviceCode: string | null;
    trackingCode: string | null;
    shippingCost: number;
    shippedAt: string | null;
    deliveredAt: string | null;
    createdAt: string;
    updatedAt: string;
  }>> {
    return apiClient.get(`/shipping/orders/${orderId}`);
  },
};
