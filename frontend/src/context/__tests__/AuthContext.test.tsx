import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';
import { AuthProvider, useAuth } from '@/context/AuthContext';

// Mock the api modules
vi.mock('@/api/auth', () => ({
  authApi: {
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    me: vi.fn(),
    refresh: vi.fn(),
  },
}));

vi.mock('@/api/client', () => ({
  apiClient: {
    setToken: vi.fn(),
    getToken: vi.fn(() => null),
  },
}));

import { authApi } from '@/api/auth';

const mockedAuthApi = vi.mocked(authApi);

const wrapper = ({ children }: { children: React.ReactNode }) =>
  React.createElement(AuthProvider, null, children);

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe('AuthContext', () => {
  it('starts as unauthenticated when no token stored', async () => {
    mockedAuthApi.me.mockRejectedValue(new Error('No token'));

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.status).toBe('unauthenticated');
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
  });

  it('login sets authenticated state on success', async () => {
    mockedAuthApi.me.mockRejectedValue(new Error('No token'));
    mockedAuthApi.login.mockResolvedValue({
      success: true,
      message: 'OK',
      data: {
        user: { id: '1', email: 'test@test.com', name: 'Test', role: 'USER' },
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
      },
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.status).toBe('unauthenticated');
    });

    await act(async () => {
      const loginResult = await result.current.login('test@test.com', 'password');
      expect(loginResult.success).toBe(true);
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user?.email).toBe('test@test.com');
  });

  it('login returns error on failure', async () => {
    mockedAuthApi.me.mockRejectedValue(new Error('No token'));
    mockedAuthApi.login.mockRejectedValue({
      success: false,
      message: 'Credenciais inválidas',
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.status).toBe('unauthenticated');
    });

    let loginResult: { success: boolean; error?: string } | undefined;
    await act(async () => {
      loginResult = await result.current.login('test@test.com', 'wrong');
    });

    expect(loginResult?.success).toBe(false);
    expect(loginResult?.error).toBe('Credenciais inválidas');
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('register sets authenticated state on success', async () => {
    mockedAuthApi.me.mockRejectedValue(new Error('No token'));
    mockedAuthApi.register.mockResolvedValue({
      success: true,
      message: 'OK',
      data: {
        user: { id: '2', email: 'new@test.com', name: 'New User', role: 'USER' },
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      },
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.status).toBe('unauthenticated');
    });

    await act(async () => {
      const registerResult = await result.current.register('new@test.com', 'password', 'New User');
      expect(registerResult.success).toBe(true);
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user?.email).toBe('new@test.com');
  });

  it('logout clears state', async () => {
    mockedAuthApi.me.mockRejectedValue(new Error('No token'));
    mockedAuthApi.login.mockResolvedValue({
      success: true,
      message: 'OK',
      data: {
        user: { id: '1', email: 'test@test.com', name: 'Test', role: 'USER' },
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
      },
    });
    mockedAuthApi.logout.mockResolvedValue({ success: true, message: 'OK' });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.status).toBe('unauthenticated');
    });

    // Login first
    await act(async () => {
      await result.current.login('test@test.com', 'password');
    });
    expect(result.current.isAuthenticated).toBe(true);

    // Then logout
    await act(async () => {
      await result.current.logout();
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
    expect(result.current.status).toBe('unauthenticated');
  });

  it('restores session from stored token', async () => {
    localStorage.setItem('access_token', 'stored-token');
    localStorage.setItem('refresh_token', 'stored-refresh');

    mockedAuthApi.me.mockResolvedValue({
      success: true,
      message: 'OK',
      data: { user: { id: '1', email: 'stored@test.com', name: 'Stored', role: 'USER' } },
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.status).toBe('authenticated');
    });

    expect(result.current.user?.email).toBe('stored@test.com');
    expect(result.current.isAuthenticated).toBe(true);
  });
});
