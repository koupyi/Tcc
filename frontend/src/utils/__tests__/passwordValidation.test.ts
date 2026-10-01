import { describe, it, expect } from 'vitest';
import { isPasswordValid, validatePassword, PASSWORD_RULES } from '@/utils/passwordValidation';

describe('passwordValidation', () => {
  describe('isPasswordValid', () => {
    it('rejects short password', () => {
      expect(isPasswordValid('abc')).toBe(false);
    });

    it('rejects password without uppercase', () => {
      expect(isPasswordValid('abcdefgh1')).toBe(false);
    });

    it('rejects password without lowercase', () => {
      expect(isPasswordValid('ABCDEFGH1')).toBe(false);
    });

    it('rejects password without number', () => {
      expect(isPasswordValid('Abcdefgh')).toBe(false);
    });

    it('rejects all-lowercase 8+ chars', () => {
      expect(isPasswordValid('abcdefgh')).toBe(false);
    });

    it('accepts valid password', () => {
      expect(isPasswordValid('Abcdefg1')).toBe(true);
    });

    it('accepts longer valid password', () => {
      expect(isPasswordValid('MyStr0ngP@ss')).toBe(true);
    });
  });

  describe('validatePassword', () => {
    it('shows all rules failing for empty string', () => {
      const results = validatePassword('');
      expect(results.every((r) => !r.passed)).toBe(true);
    });

    it('shows minLength passing for 8+ char string', () => {
      const results = validatePassword('aaaaaaaa');
      const minLength = results.find((r) => r.id === 'minLength');
      expect(minLength?.passed).toBe(true);
    });

    it('shows uppercase passing when uppercase present', () => {
      const results = validatePassword('A');
      const uppercase = results.find((r) => r.id === 'uppercase');
      expect(uppercase?.passed).toBe(true);
    });

    it('shows all passing for valid password', () => {
      const results = validatePassword('Abcdefg1');
      expect(results.every((r) => r.passed)).toBe(true);
    });
  });

  describe('PASSWORD_RULES', () => {
    it('has exactly 4 rules', () => {
      expect(PASSWORD_RULES).toHaveLength(4);
    });
  });
});
