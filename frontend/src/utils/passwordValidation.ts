/**
 * Password validation rules — shared between frontend UI and form validation.
 * Must match backend rules in validators/auth.validator.ts:
 *   - min 8 characters
 *   - at least 1 uppercase letter
 *   - at least 1 lowercase letter
 *   - at least 1 number
 */

export interface PasswordRule {
  id: string;
  label: string;
  test: (password: string) => boolean;
}

export const PASSWORD_RULES: PasswordRule[] = [
  {
    id: 'minLength',
    label: 'Mínimo de 8 caracteres',
    test: (p) => p.length >= 8,
  },
  {
    id: 'uppercase',
    label: 'Pelo menos uma letra maiúscula',
    test: (p) => /[A-Z]/.test(p),
  },
  {
    id: 'lowercase',
    label: 'Pelo menos uma letra minúscula',
    test: (p) => /[a-z]/.test(p),
  },
  {
    id: 'number',
    label: 'Pelo menos um número',
    test: (p) => /\d/.test(p),
  },
];

/**
 * Returns true if all password rules pass.
 */
export function isPasswordValid(password: string): boolean {
  return PASSWORD_RULES.every((rule) => rule.test(password));
}

/**
 * Returns validation results for each rule.
 */
export function validatePassword(password: string): { id: string; label: string; passed: boolean }[] {
  return PASSWORD_RULES.map((rule) => ({
    id: rule.id,
    label: rule.label,
    passed: rule.test(password),
  }));
}
