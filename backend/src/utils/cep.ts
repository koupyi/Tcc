/**
 * CEP utility functions for backend validation.
 */

/** Valid Brazilian UF codes */
export const VALID_UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO',
  'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI',
  'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
] as const;

export type UF = typeof VALID_UFS[number];

/**
 * Removes all non-digit characters from a CEP string.
 */
export function normalizeCep(value: string): string {
  return value.replace(/\D/g, '');
}

/**
 * Formats a canonical CEP (8 digits) to 00000-000 display format.
 */
export function formatCep(value: string): string {
  const digits = normalizeCep(value);
  if (digits.length !== 8) return value;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

/**
 * Validates if the normalized CEP has exactly 8 digits.
 */
export function isValidCepFormat(value: string): boolean {
  const digits = normalizeCep(value);
  return /^\d{8}$/.test(digits);
}

/**
 * Validates if a UF code is a valid Brazilian state abbreviation.
 */
export function isValidUF(uf: string): boolean {
  return VALID_UFS.includes(uf.toUpperCase() as UF);
}
