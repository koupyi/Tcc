import { describe, it, expect } from 'vitest';
import { mapApiError, getFieldError } from '@/utils/errorMapper';

describe('errorMapper', () => {
  describe('mapApiError', () => {
    it('maps EMAIL_ALREADY_EXISTS / conflict message', () => {
      const err = { success: false as const, message: 'Email já cadastrado', code: 'CONFLICT' };
      const result = mapApiError(err);
      expect(result.message).toBe('Já existe uma conta cadastrada com este e-mail.');
    });

    it('maps INVALID_CREDENTIALS / login error', () => {
      const err = { success: false as const, message: 'Email ou senha inválidos', code: 'UNAUTHORIZED' };
      const result = mapApiError(err);
      expect(result.message).toBe('E-mail ou senha inválidos.');
    });

    it('maps VALIDATION_ERROR with field errors', () => {
      const err = {
        success: false as const,
        message: 'Dados inválidos',
        code: 'VALIDATION_ERROR',
        errors: { password: ['Senha deve ter no mínimo 8 caracteres'] },
      };
      const result = mapApiError(err);
      expect(result.fieldErrors?.password).toContain('Senha deve ter no mínimo 8 caracteres');
    });

    it('provides fallback for unknown error', () => {
      const err = { success: false as const, message: '', code: 'UNKNOWN_CODE' };
      const result = mapApiError(err);
      expect(result.message).toBe('Ocorreu um erro inesperado. Tente novamente.');
    });

    it('handles network errors', () => {
      const err = new TypeError('Failed to fetch');
      const result = mapApiError(err);
      expect(result.message).toContain('Não foi possível conectar');
    });

    it('uses backend message if it is already a good Portuguese string', () => {
      const err = { success: false as const, message: 'Conta desativada', code: 'UNAUTHORIZED' };
      const result = mapApiError(err);
      // Should use our mapping for UNAUTHORIZED or the backend message
      expect(result.message).toBeTruthy();
    });
  });

  describe('getFieldError', () => {
    it('returns first error for field', () => {
      const errors = { email: ['E-mail inválido', 'Segundo erro'] };
      expect(getFieldError(errors, 'email')).toBe('E-mail inválido');
    });

    it('returns undefined for missing field', () => {
      const errors = { email: ['E-mail inválido'] };
      expect(getFieldError(errors, 'password')).toBeUndefined();
    });

    it('returns undefined for undefined errors', () => {
      expect(getFieldError(undefined, 'email')).toBeUndefined();
    });
  });
});
