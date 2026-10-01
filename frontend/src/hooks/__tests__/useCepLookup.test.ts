import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useCepLookup } from '@/hooks/useCepLookup';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Use unique CEPs per test to avoid module-level cache interference
let cepCounter = 10000000;
function uniqueCep(): string {
  return String(cepCounter++);
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

function mockViaCepSuccess(data: {
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
}) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      cep: '01310-100',
      logradouro: data.logradouro ?? 'Avenida Paulista',
      complemento: '',
      bairro: data.bairro ?? 'Bela Vista',
      localidade: data.localidade ?? 'São Paulo',
      uf: data.uf ?? 'SP',
    }),
  });
}

function mockViaCepNotFound() {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ erro: true }),
  });
}

function mockNetworkError() {
  mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));
}

describe('useCepLookup', () => {
  it('starts with idle status', () => {
    const { result } = renderHook(() => useCepLookup());
    expect(result.current.status).toBe('idle');
    expect(result.current.result).toBeNull();
  });

  it('returns invalid for CEP with less than 8 digits', async () => {
    const { result } = renderHook(() => useCepLookup());

    await act(async () => {
      await result.current.lookup('123');
    });

    expect(result.current.status).toBe('invalid');
    expect(result.current.result).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('does not call ViaCEP for incomplete CEP', async () => {
    const { result } = renderHook(() => useCepLookup());

    await act(async () => {
      await result.current.lookup('1234567');
    });

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('calls ViaCEP for valid 8-digit CEP', async () => {
    mockViaCepSuccess({});
    const { result } = renderHook(() => useCepLookup());
    const cep = uniqueCep();

    await act(async () => {
      await result.current.lookup(cep);
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(
      `https://viacep.com.br/ws/${cep}/json/`,
      expect.objectContaining({
        headers: { 'Accept': 'application/json' },
      })
    );
  });

  it('populates street, neighborhood, city, state on success', async () => {
    mockViaCepSuccess({
      logradouro: 'Avenida Paulista',
      bairro: 'Bela Vista',
      localidade: 'São Paulo',
      uf: 'SP',
    });
    const { result } = renderHook(() => useCepLookup());

    await act(async () => {
      await result.current.lookup(uniqueCep());
    });

    expect(result.current.status).toBe('success');
    expect(result.current.result).toEqual({
      street: 'Avenida Paulista',
      neighborhood: 'Bela Vista',
      city: 'São Paulo',
      state: 'SP',
    });
  });

  it('sets status to loading during fetch', async () => {
    let resolvePromise: (value: unknown) => void;
    const fetchPromise = new Promise((resolve) => { resolvePromise = resolve; });
    mockFetch.mockReturnValueOnce(fetchPromise);

    const { result } = renderHook(() => useCepLookup());

    // Start lookup (don't await)
    act(() => {
      result.current.lookup(uniqueCep());
    });

    // Should be loading immediately
    await waitFor(() => {
      expect(result.current.status).toBe('loading');
    });

    // Resolve the fetch
    await act(async () => {
      resolvePromise!({
        ok: true,
        json: async () => ({ logradouro: 'Rua X', bairro: 'B', localidade: 'C', uf: 'SP' }),
      });
    });

    await waitFor(() => {
      expect(result.current.status).toBe('success');
    });
  });

  it('sets not-found when ViaCEP returns erro:true', async () => {
    mockViaCepNotFound();
    const { result } = renderHook(() => useCepLookup());

    await act(async () => {
      await result.current.lookup(uniqueCep());
    });

    expect(result.current.status).toBe('not-found');
    expect(result.current.result).toBeNull();
  });

  it('sets error status on network failure', async () => {
    mockNetworkError();
    const { result } = renderHook(() => useCepLookup());

    await act(async () => {
      await result.current.lookup(uniqueCep());
    });

    expect(result.current.status).toBe('error');
    expect(result.current.result).toBeNull();
  });

  it('handles partial response (empty logradouro/bairro)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        cep: '13330-000',
        logradouro: '',
        complemento: '',
        bairro: '',
        localidade: 'Indaiatuba',
        uf: 'SP',
      }),
    });
    const { result } = renderHook(() => useCepLookup());

    await act(async () => {
      await result.current.lookup(uniqueCep());
    });

    expect(result.current.status).toBe('success');
    expect(result.current.result).toEqual({
      street: '',
      neighborhood: '',
      city: 'Indaiatuba',
      state: 'SP',
    });
  });

  it('does not send Authorization header to ViaCEP', async () => {
    mockViaCepSuccess({});
    const { result } = renderHook(() => useCepLookup());

    await act(async () => {
      await result.current.lookup(uniqueCep());
    });

    const callArgs = mockFetch.mock.calls[0];
    const options = callArgs[1];
    expect(options.headers).not.toHaveProperty('Authorization');
  });

  it('accepts masked CEP format and normalizes', async () => {
    mockViaCepSuccess({});
    const { result } = renderHook(() => useCepLookup());
    const cep = uniqueCep();
    const masked = cep.slice(0, 5) + '-' + cep.slice(5);

    await act(async () => {
      await result.current.lookup(masked);
    });

    expect(mockFetch).toHaveBeenCalledWith(
      `https://viacep.com.br/ws/${cep}/json/`,
      expect.anything()
    );
    expect(result.current.status).toBe('success');
  });

  it('uses cache on repeated lookups for same CEP', async () => {
    mockViaCepSuccess({});
    const { result } = renderHook(() => useCepLookup());
    const cep = uniqueCep();

    await act(async () => {
      await result.current.lookup(cep);
    });
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // Second lookup — should use cache
    await act(async () => {
      await result.current.lookup(cep);
    });
    // No additional fetch call
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe('success');
  });

  it('reset returns to idle state', async () => {
    mockViaCepSuccess({});
    const { result } = renderHook(() => useCepLookup());

    await act(async () => {
      await result.current.lookup(uniqueCep());
    });
    expect(result.current.status).toBe('success');

    act(() => {
      result.current.reset();
    });
    expect(result.current.status).toBe('idle');
    expect(result.current.result).toBeNull();
  });

  describe('race condition protection', () => {
    it('stale response does not overwrite current lookup', async () => {
      // Simulate: request CEP A, then request CEP B before A resolves
      let resolveA: (value: unknown) => void;
      const fetchA = new Promise((resolve) => { resolveA = resolve; });

      // First call returns slow promise (CEP A)
      mockFetch.mockReturnValueOnce(fetchA);

      // Second call returns immediately (CEP B)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          logradouro: 'Rua B',
          bairro: 'Bairro B',
          localidade: 'Cidade B',
          uf: 'RJ',
        }),
      });

      const { result } = renderHook(() => useCepLookup());
      const cepA = uniqueCep();
      const cepB = uniqueCep();

      // Start CEP A lookup
      act(() => {
        result.current.lookup(cepA);
      });

      // Immediately start CEP B lookup (this should abort A)
      await act(async () => {
        await result.current.lookup(cepB);
      });

      // Result should be from CEP B
      expect(result.current.status).toBe('success');
      expect(result.current.result).toEqual({
        street: 'Rua B',
        neighborhood: 'Bairro B',
        city: 'Cidade B',
        state: 'RJ',
      });

      // Now resolve A (stale) — it should be aborted and not affect state
      await act(async () => {
        resolveA!({
          ok: true,
          json: async () => ({
            logradouro: 'Rua A',
            bairro: 'Bairro A',
            localidade: 'Cidade A',
            uf: 'SP',
          }),
        });
      });

      // State should still be CEP B
      expect(result.current.result).toEqual({
        street: 'Rua B',
        neighborhood: 'Bairro B',
        city: 'Cidade B',
        state: 'RJ',
      });
    });
  });
});
