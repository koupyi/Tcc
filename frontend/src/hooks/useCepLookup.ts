/**
 * ViaCEP lookup hook — fetches address data from ViaCEP when CEP is valid.
 *
 * Architecture decision: Frontend → ViaCEP directly.
 * Reasons:
 * - ViaCEP is public (no secret key required)
 * - CORS works for viacep.com.br
 * - Only CEP is sent (no PII)
 * - No backend proxy complexity needed
 *
 * Features:
 * - AbortController for stale request protection (race condition)
 * - Timeout of 8 seconds
 * - Simple in-memory cache per session
 * - Does NOT block form if ViaCEP fails — manual fallback always available
 * - Does NOT send auth tokens to external domain
 */
import { useState, useCallback, useRef } from 'react';
import { normalizeCep, isValidCepFormat } from '@/utils/cep';

export type CepLookupStatus = 'idle' | 'invalid' | 'loading' | 'success' | 'not-found' | 'error';

export interface CepLookupResult {
  street: string;
  neighborhood: string;
  city: string;
  state: string;
}

interface ViaCepResponse {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  localidade: string;
  uf: string;
  erro?: boolean;
}

const VIACEP_TIMEOUT_MS = 8000;

// Session-level cache to avoid repeated requests for the same CEP
const cepCache = new Map<string, CepLookupResult | 'not-found'>();

export interface UseCepLookupReturn {
  status: CepLookupStatus;
  result: CepLookupResult | null;
  lookup: (cep: string) => Promise<CepLookupResult | null>;
  reset: () => void;
}

export function useCepLookup(): UseCepLookupReturn {
  const [status, setStatus] = useState<CepLookupStatus>('idle');
  const [result, setResult] = useState<CepLookupResult | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    setStatus('idle');
    setResult(null);
  }, []);

  const lookup = useCallback(async (cep: string): Promise<CepLookupResult | null> => {
    const normalized = normalizeCep(cep);

    // Validate format locally before any request
    if (!isValidCepFormat(normalized)) {
      setStatus('invalid');
      setResult(null);
      return null;
    }

    // Check cache
    const cached = cepCache.get(normalized);
    if (cached === 'not-found') {
      setStatus('not-found');
      setResult(null);
      return null;
    }
    if (cached) {
      setStatus('success');
      setResult(cached);
      return cached;
    }

    // Cancel any previous in-flight request (stale response protection)
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    // Timeout protection — abort after VIACEP_TIMEOUT_MS
    const timeoutId = setTimeout(() => controller.abort(), VIACEP_TIMEOUT_MS);

    setStatus('loading');
    setResult(null);

    try {
      // NOTE: No Authorization header — ViaCEP is public, never send tokens
      const response = await fetch(
        `https://viacep.com.br/ws/${normalized}/json/`,
        {
          signal: controller.signal,
          headers: { 'Accept': 'application/json' },
        }
      );

      clearTimeout(timeoutId);

      // If this request was aborted (new CEP typed), do nothing
      if (controller.signal.aborted) return null;

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data: ViaCepResponse = await response.json();

      // Check if aborted after parsing
      if (controller.signal.aborted) return null;

      // ViaCEP returns { erro: true } for non-existent CEPs
      if (data.erro) {
        cepCache.set(normalized, 'not-found');
        setStatus('not-found');
        setResult(null);
        return null;
      }

      // Success — map ViaCEP fields to our domain model
      // Fields may be empty for generic CEPs (e.g., rural areas)
      const lookupResult: CepLookupResult = {
        street: data.logradouro || '',
        neighborhood: data.bairro || '',
        city: data.localidade || '',
        state: data.uf || '',
      };

      cepCache.set(normalized, lookupResult);
      setStatus('success');
      setResult(lookupResult);
      return lookupResult;
    } catch (err: unknown) {
      clearTimeout(timeoutId);

      // AbortError — either timeout or user typed new CEP
      if (err instanceof DOMException && err.name === 'AbortError') {
        // Only set error state if this controller is still the current one
        // (i.e., it was a timeout, not a user-initiated cancel)
        if (abortControllerRef.current === controller) {
          setStatus('error');
          setResult(null);
        }
        return null;
      }

      // Network/server error — user can fill manually
      setStatus('error');
      setResult(null);
      return null;
    }
  }, []);

  return { status, result, lookup, reset };
}
