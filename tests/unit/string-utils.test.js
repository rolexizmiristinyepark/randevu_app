/**
 * StringUtils Unit Tests
 */

import { describe, it, expect } from 'vitest';
import { StringUtils } from '../../string-utils.ts';

describe('StringUtils.toTitleCase()', () => {
  it('should convert to title case', () => {
    expect(StringUtils.toTitleCase('ahmet mehmet')).toBe('Ahmet Mehmet');
  });

  it('should handle Turkish characters', () => {
    expect(StringUtils.toTitleCase('şükran çiğdem')).toBe('Şükran Çiğdem');
    expect(StringUtils.toTitleCase('istanbul üniversitesi')).toBe('Istanbul Üniversitesi');
  });

  it('should handle single word', () => {
    expect(StringUtils.toTitleCase('hello')).toBe('Hello');
  });

  it('should handle empty string', () => {
    expect(StringUtils.toTitleCase('')).toBe('');
  });

  it('should handle null/undefined', () => {
    expect(StringUtils.toTitleCase(null)).toBeNull();
    expect(StringUtils.toTitleCase(undefined)).toBeUndefined();
  });

  it('should handle already title case', () => {
    expect(StringUtils.toTitleCase('Ahmet Mehmet')).toBe('Ahmet Mehmet');
  });

  it('should handle all uppercase', () => {
    expect(StringUtils.toTitleCase('AHMET MEHMET')).toBe('Ahmet Mehmet');
  });

  it('should handle multiple spaces', () => {
    expect(StringUtils.toTitleCase('ahmet  mehmet')).toBe('Ahmet  Mehmet');
  });
});
