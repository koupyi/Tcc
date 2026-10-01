import { apiClient, ApiResponse } from './client';

// ==========================================
// Admin API Client
// ==========================================

export const adminApi = {
  // Dashboard
  getDashboard(): Promise<ApiResponse<Record<string, unknown>>> {
    return apiClient.get('/admin/dashboard');
  },

  // Categories
  getCategories(): Promise<ApiResponse<unknown[]>> {
    return apiClient.get('/admin/categories');
  },
  getCategory(id: string): Promise<ApiResponse<unknown>> {
    return apiClient.get(`/admin/categories/${id}`);
  },
  createCategory(data: { name: string; slug?: string; parentId?: string | null }): Promise<ApiResponse<unknown>> {
    return apiClient.post('/admin/categories', data);
  },
  updateCategory(id: string, data: { name?: string; slug?: string; parentId?: string | null }): Promise<ApiResponse<unknown>> {
    return apiClient.patch(`/admin/categories/${id}`, data);
  },
  deleteCategory(id: string): Promise<ApiResponse<unknown>> {
    return apiClient.delete(`/admin/categories/${id}`);
  },

  // Inventory
  getInventory(params?: Record<string, string>): Promise<ApiResponse<unknown[]>> {
    return apiClient.get('/admin/inventory', params);
  },
  updateStock(id: string, stockQty: number): Promise<ApiResponse<unknown>> {
    return apiClient.patch(`/admin/inventory/${id}`, { stockQty });
  },

  // Orders
  getOrders(params?: Record<string, string>): Promise<ApiResponse<unknown[]>> {
    return apiClient.get('/admin/orders', params);
  },
  getOrder(id: string): Promise<ApiResponse<unknown>> {
    return apiClient.get(`/admin/orders/${id}`);
  },
  updateOrderStatus(id: string, status: string, cancelReason?: string): Promise<ApiResponse<unknown>> {
    return apiClient.patch(`/admin/orders/${id}/status`, { status, ...(cancelReason ? { cancelReason } : {}) });
  },

  // Products (reuses existing /products CRUD — admin-guarded on the backend)
  getProducts(params?: Record<string, string>): Promise<ApiResponse<unknown[]>> {
    return apiClient.get('/products', params);
  },
  createProduct(data: Record<string, unknown>): Promise<ApiResponse<unknown>> {
    return apiClient.post('/products', data);
  },
  updateProduct(id: string, data: Record<string, unknown>): Promise<ApiResponse<unknown>> {
    return apiClient.patch(`/products/${id}`, data);
  },
  deleteProduct(id: string): Promise<ApiResponse<unknown>> {
    return apiClient.delete(`/products/${id}`);
  },

  // Payments
  getPayments(params?: Record<string, string>): Promise<ApiResponse<unknown[]>> {
    return apiClient.get('/admin/payments', params);
  },
  getPayment(id: string): Promise<ApiResponse<unknown>> {
    return apiClient.get(`/admin/payments/${id}`);
  },

  // Shipments
  getShipments(params?: Record<string, string>): Promise<ApiResponse<unknown[]>> {
    return apiClient.get('/admin/shipments', params);
  },
  getShipment(id: string): Promise<ApiResponse<unknown>> {
    return apiClient.get(`/admin/shipments/${id}`);
  },
  updateShipmentStatus(id: string, status: string): Promise<ApiResponse<unknown>> {
    return apiClient.patch(`/admin/shipments/${id}/status`, { status });
  },

  // Users
  getUsers(params?: Record<string, string>): Promise<ApiResponse<unknown[]>> {
    return apiClient.get('/admin/users', params);
  },
};
