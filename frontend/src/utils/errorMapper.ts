/**
 * Error mapper — translates API error codes to user-friendly PT-BR messages.
 * Central point for all error → UI message translation.
 */
import { ApiError } from './client';

const ERROR_MESSAGES: Record<string, string> = {
  // Auth
  UNAUTHORIZED: 'Sua sessão expirou. Entre novamente.',
  FORBIDDEN: 'Você não tem permissão para realizar esta ação.',
  INVALID_CREDENTIALS: 'E-mail ou senha inválidos.',

  // Conflict
  CONFLICT: 'Já existe uma conta cadastrada com este e-mail.',
  UNIQUE_CONSTRAINT: 'Já existe um registro com esses dados.',

  // Validation
  VALIDATION_ERROR: 'Dados inválidos. Verifique os campos e tente novamente.',
  UNPROCESSABLE: 'Dados inválidos. Verifique os campos e tente novamente.',

  // Not found
  NOT_FOUND: 'Não foi possível encontrar o recurso solicitado.',
  ROUTE_NOT_FOUND: 'Página não encontrada.',

  // Rate limit
  TOO_MANY_REQUESTS: 'Muitas tentativas. Aguarde um momento e tente novamente.',

  // Server
  INTERNAL_ERROR: 'Ocorreu um erro inesperado. Tente novamente.',
  DATABASE_ERROR: 'Ocorreu um erro inesperado. Tente novamente.',

  // Stock
  INSUFFICIENT_STOCK: 'Estoque insuficiente para este produto.',
};

const NETWORK_ERROR_MESSAGE = 'Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.';

export interface MappedError {
  message: string;
  fieldErrors?: Record<string, string[]>;
}

/**
 * Maps an API error (or unknown error) to a user-friendly message.
 */
export function mapApiError(error: unknown): MappedError {
  // Network error (fetch failed)
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return { message: NETWORK_ERROR_MESSAGE };
  }

  // ApiError from our client
  if (isApiError(error)) {
    const code = error.code || '';
    const fieldErrors = error.errors;

    // "Email já cadastrado" from backend
    if (error.message?.includes('Email já cadastrado')) {
      return { message: 'Já existe uma conta cadastrada com este e-mail.', fieldErrors };
    }

    // "Email ou senha inválidos" from backend
    if (error.message?.includes('Email ou senha inválidos')) {
      return { message: 'E-mail ou senha inválidos.', fieldErrors };
    }

    // Known code mapping
    if (code && ERROR_MESSAGES[code]) {
      return { message: ERROR_MESSAGES[code], fieldErrors };
    }

    // If backend already provides a good Portuguese message, use it
    if (error.message && !looksLikeJson(error.message) && !looksLikeTechnical(error.message)) {
      return { message: error.message, fieldErrors };
    }

    // Fallback
    return { message: 'Ocorreu um erro inesperado. Tente novamente.', fieldErrors };
  }

  // Generic Error
  if (error instanceof Error) {
    if (error.message.includes('fetch') || error.message.includes('network') || error.message.includes('Failed to fetch')) {
      return { message: NETWORK_ERROR_MESSAGE };
    }
  }

  return { message: 'Ocorreu um erro inesperado. Tente novamente.' };
}

/**
 * Extracts the first field error message for a given field.
 */
export function getFieldError(fieldErrors: Record<string, string[]> | undefined, field: string): string | undefined {
  if (!fieldErrors) return undefined;
  const errors = fieldErrors[field];
  return errors && errors.length > 0 ? errors[0] : undefined;
}

function isApiError(error: unknown): error is ApiError {
  return typeof error === 'object' && error !== null && 'success' in error && (error as ApiError).success === false;
}

function looksLikeJson(str: string): boolean {
  return str.startsWith('{') || str.startsWith('[');
}

function looksLikeTechnical(str: string): boolean {
  return str.includes('Error:') || str.includes('TypeError') || str.includes('at ') || str.length > 200;
}
