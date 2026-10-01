/**
 * CEP utility functions — normalize, format, validate.
 * Reusable across Account, Checkout, and any address form.
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
 * @example normalizeCep("01310-100") → "01310100"
 * @example normalizeCep(" 01310-100 ") → "01310100"
 */
export function normalizeCep(value: string): string {
  return value.replace(/\D/g, '');
}

/**
 * Formats a canonical (digits-only) CEP to display format 00000-000.
 * If input doesn't have 8 digits, returns the input as-is.
 * @example formatCep("01310100") → "01310-100"
 */
export function formatCep(value: string): string {
  const digits = normalizeCep(value);
  if (digits.length !== 8) return value;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

/**
 * Validates if the normalized CEP has exactly 8 digits.
 * Does NOT validate if the CEP exists — only format.
 * @example isValidCepFormat("01310100") → true
 * @example isValidCepFormat("01310-100") → true (normalizes internally)
 * @example isValidCepFormat("123") → false
 * @example isValidCepFormat("123456789") → false
 * @example isValidCepFormat("abcdefgh") → false
 */
export function isValidCepFormat(value: string): boolean {
  const digits = normalizeCep(value);
  return /^\d{8}$/.test(digits);
}

/**
 * Applies CEP mask to user input (as they type).
 * Limits to 8 digits and inserts hyphen after 5th digit.
 */
export function maskCep(value: string): string {
  const digits = normalizeCep(value).slice(0, 8);
  if (digits.length > 5) {
    return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  }
  return digits;
}

/**
 * Validates if a UF code is a valid Brazilian state abbreviation.
 */
export function isValidUF(uf: string): boolean {
  return VALID_UFS.includes(uf.toUpperCase() as UF);
}
