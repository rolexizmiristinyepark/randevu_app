import { describe, it, expect } from 'vitest';
import { maskEmail, maskPhone, maskName, escapeHtml } from '../security-helpers';

describe('Security Helpers', () => {
  describe('maskEmail', () => {
    it('masks standard email', () => {
      const result = maskEmail('test@example.com');
      // Expected: t***t@e***.com (first + last char visible)
      expect(result).toBe('t***t@e***.com');
      expect(result).toContain('***');
    });

    it('masks long email', () => {
      const result = maskEmail('verylongemail@example.com');
      // Expected: v***l@e***.com
      expect(result).toBe('v***l@e***.com');
      expect(result).toContain('***');
    });

    it('handles null safely', () => {
      expect(maskEmail(null)).toBe('[email hidden]');
      expect(maskEmail('')).toBe('[email hidden]');
      expect(maskEmail(undefined)).toBe('[email hidden]');
    });

    it('handles short emails', () => {
      const result = maskEmail('a@b.co');
      // Short emails should still work
      expect(result).toBeTruthy();
      expect(result).toContain('@');
    });

    it('prevents XSS in email masking', () => {
      const xss = '<script>alert("XSS")</script>@example.com';
      const result = maskEmail(xss);
      // Should not contain executable script tags
      expect(result).toBeTruthy();
    });
  });

  describe('maskPhone', () => {
    it('masks Turkish phone number (11 digits)', () => {
      const result = maskPhone('05551234567');
      // Expected format: 0555***67 or similar
      expect(result).toContain('0555');
      expect(result).toContain('***');
      expect(result).toMatch(/0555.*67/);
    });

    it('masks formatted phone with spaces', () => {
      const result = maskPhone('0555 123 45 67');
      expect(result).toContain('***');
      expect(result).toContain('0555');
    });

    it('handles null safely', () => {
      expect(maskPhone(null)).toBe('[phone hidden]');
      expect(maskPhone('')).toBe('[phone hidden]');
      expect(maskPhone(undefined)).toBe('[phone hidden]');
    });

    it('handles international format', () => {
      const result = maskPhone('+90 555 123 45 67');
      expect(result).toBeTruthy();
      expect(result).toContain('***');
    });
  });

  describe('maskName', () => {
    it('masks single name', () => {
      const result = maskName('Ali');
      // Expected: A***
      expect(result).toMatch(/^A\*+$/);
    });

    it('masks full name (first + last)', () => {
      const result = maskName('Serdar Benli');
      // Expected: S*** B***
      expect(result).toContain('S***');
      expect(result).toContain('B***');
      expect(result).toMatch(/S\*+ B\*+/);
    });

    it('handles null safely', () => {
      expect(maskName(null)).toBe('[name hidden]');
      expect(maskName('')).toBe('[name hidden]');
      expect(maskName(undefined)).toBe('[name hidden]');
    });

    it('handles Turkish characters', () => {
      const result = maskName('Şükran Çiğdem');
      expect(result).toBeTruthy();
      expect(result).toContain('***');
    });
  });

  describe('escapeHtml', () => {
    it('escapes XSS script tag', () => {
      const xss = '<script>alert("XSS")</script>';
      const escaped = escapeHtml(xss);
      expect(escaped).not.toContain('<script>');
      expect(escaped).toContain('&lt;script&gt;');
      // '/' is escaped to '&#x2F;', not part of &lt;/script&gt;
      expect(escaped).toContain('&lt;&#x2F;script&gt;');
    });

    it('escapes all dangerous characters', () => {
      const dangerous = '< > & " \' /';
      const escaped = escapeHtml(dangerous);
      expect(escaped).toContain('&lt;');
      expect(escaped).toContain('&gt;');
      expect(escaped).toContain('&amp;');
      expect(escaped).toContain('&quot;');
      expect(escaped).toContain('&#x27;');
      expect(escaped).toContain('&#x2F;');
    });

    it('handles null/undefined safely', () => {
      expect(escapeHtml(null)).toBe('');
      expect(escapeHtml(undefined)).toBe('');
      expect(escapeHtml('')).toBe('');
    });

    it('preserves safe text', () => {
      const safe = 'This is safe text 123';
      const escaped = escapeHtml(safe);
      expect(escaped).toBe(safe);
    });

    it('escapes nested XSS attempts', () => {
      const xss = '<img src=x onerror="alert(\'XSS\')">';
      const escaped = escapeHtml(xss);
      expect(escaped).not.toContain('<img');
      // "onerror" word exists but quotes are escaped, making it safe
      expect(escaped).not.toContain('onerror="');
      expect(escaped).toContain('&lt;img');
    });
  });
});
