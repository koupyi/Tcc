import { describe, it, expect } from 'vitest';
import { normalizeCep, formatCep, isValidCepFormat, maskCep, isValidUF } from '../cep';

describe('normalizeCep', () => {
  it('removes hyphen', () => {
    expect(normalizeCep('01310-100')).toBe('01310100');
  });

  it('keeps already normalized CEP', () => {
    expect(normalizeCep('01310100')).toBe('01310100');
  });

  it('removes spaces and hyphen', () => {
    expect(normalizeCep(' 01310-100 ')).toBe('01310100');
  });

  it('removes letters and special chars', () => {
    expect(normalizeCep('abc01310-100xyz')).toBe('01310100');
  });

  it('handles empty string', () => {
    expect(normalizeCep('')).toBe('');
  });
});

describe('formatCep', () => {
  it('formats 8 digits to 00000-000', () => {
    expect(formatCep('01310100')).toBe('01310-100');
  });

  it('formats 13330000', () => {
    expect(formatCep('13330000')).toBe('13330-000');
  });

  it('returns input as-is if not 8 digits', () => {
    expect(formatCep('123')).toBe('123');
    expect(formatCep('123456789')).toBe('123456789');
  });

  it('normalizes before formatting', () => {
    expect(formatCep('01310-100')).toBe('01310-100');
  });
});

describe('isValidCepFormat', () => {
  it('returns true for 8-digit CEP', () => {
    expect(isValidCepFormat('01310100')).toBe(true);
  });

  it('returns true for masked CEP (normalizes internally)', () => {
    expect(isValidCepFormat('01310-100')).toBe(true);
  });

  it('returns false for too few digits', () => {
    expect(isValidCepFormat('123')).toBe(false);
  });

  it('returns false for too many digits', () => {
    expect(isValidCepFormat('123456789')).toBe(false);
  });

  it('returns false for letters', () => {
    expect(isValidCepFormat('abcdefgh')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isValidCepFormat('')).toBe(false);
  });

  it('returns false for 7 digits', () => {
    expect(isValidCepFormat('1234567')).toBe(false);
  });

  it('returns true for CEP with spaces + hyphen', () => {
    expect(isValidCepFormat(' 01310-100 ')).toBe(true);
  });
});

describe('maskCep', () => {
  it('inserts hyphen after 5th digit', () => {
    expect(maskCep('01310100')).toBe('01310-100');
  });

  it('keeps short input without hyphen', () => {
    expect(maskCep('013')).toBe('013');
    expect(maskCep('01310')).toBe('01310');
  });

  it('limits to 8 digits', () => {
    expect(maskCep('013101001234')).toBe('01310-100');
  });

  it('removes non-digit chars', () => {
    expect(maskCep('01310-100')).toBe('01310-100');
  });
});

describe('isValidUF', () => {
  it('validates known UFs', () => {
    expect(isValidUF('SP')).toBe(true);
    expect(isValidUF('RJ')).toBe(true);
    expect(isValidUF('MG')).toBe(true);
    expect(isValidUF('DF')).toBe(true);
  });

  it('validates lowercase (case-insensitive)', () => {
    expect(isValidUF('sp')).toBe(true);
    expect(isValidUF('rj')).toBe(true);
  });

  it('rejects invalid UFs', () => {
    expect(isValidUF('XX')).toBe(false);
    expect(isValidUF('ZZ')).toBe(false);
    expect(isValidUF('')).toBe(false);
    expect(isValidUF('ABC')).toBe(false);
  });
});
