import { apiClient, ApiResponse } from './client';

export interface Payment {
  id: string;
  orderId: string;
  method: string;
  status: 'PENDING' | 'PAID' | 'FAILED' | 'CANCELLED' | 'REFUNDED';
  amount: number;
  currency: string;
  gatewayId: string | null;
  gatewayResponse: {
    qrCode?: string;
    qrCodeBase64?: string;
    expiresAt?: string;
  } | null;
  paidAt: string | null;
  failedAt: string | null;
  createdAt: string;
}

export const paymentsApi = {
  create(orderId: string): Promise<ApiResponse<Payment>> {
    return apiClient.post(`/payments/${orderId}/process`);
  },

  getByOrderId(orderId: string): Promise<ApiResponse<Payment>> {
    return apiClient.get(`/payments/${orderId}`);
  },
};
