import { apiClient, ApiResponse } from './client';

export interface Address {
  id: string;
  userId: string;
  label: string | null;
  recipientName: string | null;
  street: string;
  number: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  isDefault: boolean;
}

export interface CreateAddressInput {
  label?: string;
  recipientName: string;
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
  zipCode: string;
  isDefault?: boolean;
}

export const addressApi = {
  list(): Promise<ApiResponse<Address[]>> {
    return apiClient.get('/addresses');
  },

  create(input: CreateAddressInput): Promise<ApiResponse<Address>> {
    return apiClient.post('/addresses', input);
  },

  update(id: string, input: Partial<CreateAddressInput>): Promise<ApiResponse<Address>> {
    return apiClient.patch(`/addresses/${id}`, input);
  },

  remove(id: string): Promise<ApiResponse<null>> {
    return apiClient.delete(`/addresses/${id}`);
  },
};
