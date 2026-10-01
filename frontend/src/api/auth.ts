import { apiClient, ApiResponse } from './client';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
  phone?: string;
  avatarUrl?: string;
  isEmailVerified?: boolean;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginResponse {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
  phone?: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export const authApi = {
  register(input: RegisterInput): Promise<ApiResponse<LoginResponse>> {
    return apiClient.post('/auth/register', input);
  },

  login(input: LoginInput): Promise<ApiResponse<LoginResponse>> {
    return apiClient.post('/auth/login', input);
  },

  refresh(refreshToken: string): Promise<ApiResponse<AuthTokens>> {
    return apiClient.post('/auth/refresh', { refreshToken });
  },

  logout(refreshToken?: string): Promise<ApiResponse<null>> {
    return apiClient.post('/auth/logout', { refreshToken });
  },

  me(): Promise<ApiResponse<{ user: AuthUser }>> {
    return apiClient.get('/auth/me');
  },

  changePassword(currentPassword: string, newPassword: string, confirmPassword: string): Promise<ApiResponse<null>> {
    return apiClient.post('/auth/change-password', {
      currentPassword,
      newPassword,
      confirmPassword,
    });
  },
};
