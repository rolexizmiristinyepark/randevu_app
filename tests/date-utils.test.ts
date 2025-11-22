import { describe, it, expect } from 'vitest';
import { DateUtils } from '../date-utils';

describe('DateUtils', () => {
  describe('Constants', () => {
    it('should have 12 Turkish month names', () => {
      expect(DateUtils.MONTHS_TR).toHaveLength(12);
      expect(DateUtils.MONTHS_TR[0]).toBe('Ocak');
      expect(DateUtils.MONTHS_TR[11]).toBe('Aralık');
    });

    it('should have correct Turkish month names with characters', () => {
      expect(DateUtils.MONTHS_TR[1]).toBe('Şubat'); // Ş
      expect(DateUtils.MONTHS_TR[7]).toBe('Ağustos'); // Ğ
      expect(DateUtils.MONTHS_TR[8]).toBe('Eylül'); // ü
    });

    it('should have 7 Turkish day names', () => {
      expect(DateUtils.DAYS_TR).toHaveLength(7);
      expect(DateUtils.DAYS_TR[0]).toBe('Pazar');
      expect(DateUtils.DAYS_TR[6]).toBe('Cumartesi');
    });

    it('should have correct Turkish day names with characters', () => {
      expect(DateUtils.DAYS_TR[3]).toBe('Çarşamba'); // Ç, ş
      expect(DateUtils.DAYS_TR[4]).toBe('Perşembe'); // ş
    });
  });

  describe('toLocalDate()', () => {
    it('should format date as YYYY-MM-DD', () => {
      const date = new Date('2025-02-15T14:30:00');
      expect(DateUtils.toLocalDate(date)).toBe('2025-02-15');
    });

    it('should pad single digit months and days with zero', () => {
      const date = new Date('2025-03-05T10:00:00');
      expect(DateUtils.toLocalDate(date)).toBe('2025-03-05');
    });

    it('should handle first day of year', () => {
      const date = new Date('2025-01-01T00:00:00');
      expect(DateUtils.toLocalDate(date)).toBe('2025-01-01');
    });

    it('should handle last day of year', () => {
      const date = new Date('2025-12-31T23:59:59');
      expect(DateUtils.toLocalDate(date)).toBe('2025-12-31');
    });

    it('should ignore time component', () => {
      const morning = new Date('2025-02-15T08:00:00');
      const evening = new Date('2025-02-15T20:00:00');

      expect(DateUtils.toLocalDate(morning)).toBe('2025-02-15');
      expect(DateUtils.toLocalDate(evening)).toBe('2025-02-15');
    });
  });

  describe('toICSDate()', () => {
    it('should format date as YYYYMMDDTHHmmss (iCalendar format)', () => {
      const date = new Date('2025-02-15T14:30:45');
      expect(DateUtils.toICSDate(date)).toBe('20250215T143045');
    });

    it('should pad single digits with zeros', () => {
      const date = new Date('2025-03-05T09:05:03');
      expect(DateUtils.toICSDate(date)).toBe('20250305T090503');
    });

    it('should handle midnight', () => {
      const date = new Date('2025-02-15T00:00:00');
      expect(DateUtils.toICSDate(date)).toBe('20250215T000000');
    });

    it('should handle end of day', () => {
      const date = new Date('2025-02-15T23:59:59');
      expect(DateUtils.toICSDate(date)).toBe('20250215T235959');
    });

    it('should not have separators or spaces', () => {
      const date = new Date('2025-02-15T14:30:00');
      const icsDate = DateUtils.toICSDate(date);

      expect(icsDate).not.toContain('-');
      expect(icsDate).not.toContain(':');
      expect(icsDate).not.toContain(' ');
      expect(icsDate).toContain('T'); // Only separator
    });

    it('should match calendar-integration.test.ts format', () => {
      // Ensure consistency with calendar integration
      const date = new Date('2025-02-15T14:30:00');
      expect(DateUtils.toICSDate(date)).toBe('20250215T143000');
    });
  });

  describe('toTurkishDate()', () => {
    it('should format date in Turkish readable format', () => {
      const date = new Date('2025-02-15T14:30:00'); // Saturday
      const result = DateUtils.toTurkishDate(date);

      expect(result).toContain('15');
      expect(result).toContain('Şubat');
      expect(result).toContain('2025');
      expect(result).toContain('Cumartesi');
    });

    it('should handle different days of week', () => {
      // Sunday, February 16, 2025
      const sunday = new Date('2025-02-16T10:00:00');
      expect(DateUtils.toTurkishDate(sunday)).toContain('Pazar');

      // Monday, February 17, 2025
      const monday = new Date('2025-02-17T10:00:00');
      expect(DateUtils.toTurkishDate(monday)).toContain('Pazartesi');
    });

    it('should handle different months', () => {
      const january = new Date('2025-01-15T10:00:00');
      expect(DateUtils.toTurkishDate(january)).toContain('Ocak');

      const december = new Date('2025-12-15T10:00:00');
      expect(DateUtils.toTurkishDate(december)).toContain('Aralık');
    });

    it('should include comma separator', () => {
      const date = new Date('2025-02-15T14:30:00');
      const result = DateUtils.toTurkishDate(date);

      expect(result).toContain(',');
      expect(result.split(',')).toHaveLength(2);
    });

    it('should preserve Turkish characters', () => {
      const march = new Date('2025-03-12T10:00:00'); // Wednesday
      const result = DateUtils.toTurkishDate(march);

      expect(result).toContain('Çarşamba'); // Ç, ş
    });

    it('should handle single digit days', () => {
      const firstDay = new Date('2025-02-01T10:00:00');
      const result = DateUtils.toTurkishDate(firstDay);

      expect(result).toContain('1 Şubat');
      expect(result).not.toContain('01'); // Not padded
    });

    it('should have format: "DD MonthName YYYY, DayName"', () => {
      const date = new Date('2025-02-15T14:30:00');
      const result = DateUtils.toTurkishDate(date);

      // Example: "15 Şubat 2025, Cumartesi"
      // Check format components instead of regex (Turkish chars don't match \w)
      expect(result).toContain(' 2025, ');
      expect(result).toContain('Şubat');
      expect(result).toContain('Cumartesi');
      expect(result.startsWith('15')).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle leap year February 29th', () => {
      const leapDay = new Date('2024-02-29T12:00:00');

      expect(DateUtils.toLocalDate(leapDay)).toBe('2024-02-29');
      expect(DateUtils.toICSDate(leapDay)).toBe('20240229T120000');
      expect(DateUtils.toTurkishDate(leapDay)).toContain('29 Şubat 2024');
    });

    it('should handle year boundaries', () => {
      const newYear = new Date('2025-01-01T00:00:00');

      expect(DateUtils.toLocalDate(newYear)).toBe('2025-01-01');
      expect(DateUtils.toTurkishDate(newYear)).toContain('1 Ocak 2025');
    });

    it('should handle far future dates', () => {
      const future = new Date('2099-12-31T23:59:59');

      expect(DateUtils.toLocalDate(future)).toBe('2099-12-31');
      expect(DateUtils.toICSDate(future)).toBe('20991231T235959');
    });

    it('should handle early morning hours', () => {
      const earlyMorning = new Date('2025-02-15T03:07:09');

      expect(DateUtils.toICSDate(earlyMorning)).toBe('20250215T030709');
    });
  });
});
