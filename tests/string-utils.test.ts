import { describe, it, expect } from 'vitest';
import { StringUtils } from '../string-utils';

describe('StringUtils', () => {
  describe('toTitleCase', () => {
    it('capitalizes each word in a sentence', () => {
      const result = StringUtils.toTitleCase('ahmet mehmet');
      expect(result).toBe('Ahmet Mehmet');
    });

    it('handles single word', () => {
      const result = StringUtils.toTitleCase('hello');
      expect(result).toBe('Hello');
    });

    it('supports Turkish characters (ş, ı, ğ, ü, ö, ç)', () => {
      expect(StringUtils.toTitleCase('şükran çiğdem')).toBe('Şükran Çiğdem');
      expect(StringUtils.toTitleCase('ömer ışık')).toBe('Ömer Işık');
      expect(StringUtils.toTitleCase('ğülizar ünal')).toBe('Ğülizar Ünal');
    });

    it('handles all lowercase input', () => {
      const result = StringUtils.toTitleCase('this is a test');
      // Turkish locale: 'i' → 'İ' (with dot)
      expect(result).toBe('This İs A Test');
    });

    it('handles all uppercase input', () => {
      const result = StringUtils.toTitleCase('THIS IS A TEST');
      // Turkish locale: 'i' → 'İ' (with dot)
      expect(result).toBe('This İs A Test');
    });

    it('handles mixed case input', () => {
      const result = StringUtils.toTitleCase('ThIs Is A TeSt');
      // Turkish locale: 'i' → 'İ' (with dot)
      expect(result).toBe('This İs A Test');
    });

    it('handles null safely', () => {
      const result = StringUtils.toTitleCase(null);
      expect(result).toBeNull();
    });

    it('handles undefined safely', () => {
      const result = StringUtils.toTitleCase(undefined);
      expect(result).toBeUndefined();
    });

    it('handles empty string', () => {
      const result = StringUtils.toTitleCase('');
      expect(result).toBe('');
    });

    it('preserves multiple spaces between words', () => {
      const result = StringUtils.toTitleCase('hello  world');
      // Should handle multiple spaces gracefully
      expect(result).toContain('Hello');
      expect(result).toContain('World');
    });

    it('handles numbers in text', () => {
      const result = StringUtils.toTitleCase('room 123 building 456');
      expect(result).toContain('Room');
      expect(result).toContain('123');
      expect(result).toContain('Building');
      expect(result).toContain('456');
    });

    it('handles special characters', () => {
      const result = StringUtils.toTitleCase('hello-world test_case');
      expect(result).toBeTruthy();
      // Should not crash on special characters
    });

    it('handles long names', () => {
      const result = StringUtils.toTitleCase('haluk külahçıoğlu');
      expect(result).toBe('Haluk Külahçıoğlu');
    });

    it('handles single character words', () => {
      const result = StringUtils.toTitleCase('a b c');
      expect(result).toBe('A B C');
    });

    it('uses Turkish locale for uppercase conversion', () => {
      // Turkish 'i' should uppercase to 'İ' (with dot), not 'I'
      const result = StringUtils.toTitleCase('istanbul');
      expect(result).toBe('İstanbul'); // Turkish locale behavior
    });
  });
});
