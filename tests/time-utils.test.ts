import { describe, it, expect } from 'vitest';
import { TimeUtils } from '../time-utils';

describe('TimeUtils', () => {
    describe('toTimeString', () => {
        it('should format time as HH:MM', () => {
            const date = new Date('2025-01-22T14:30:45');
            expect(TimeUtils.toTimeString(date)).toBe('14:30');
        });

        it('should pad single digit hours and minutes', () => {
            const date = new Date('2025-01-22T09:05:30');
            expect(TimeUtils.toTimeString(date)).toBe('09:05');
        });

        it('should handle midnight', () => {
            const date = new Date('2025-01-22T00:00:00');
            expect(TimeUtils.toTimeString(date)).toBe('00:00');
        });

        it('should handle noon', () => {
            const date = new Date('2025-01-22T12:00:00');
            expect(TimeUtils.toTimeString(date)).toBe('12:00');
        });

        it('should handle 23:59', () => {
            const date = new Date('2025-01-22T23:59:59');
            expect(TimeUtils.toTimeString(date)).toBe('23:59');
        });
    });

    describe('toTimeStringWithSeconds', () => {
        it('should format time as HH:MM:SS', () => {
            const date = new Date('2025-01-22T14:30:45');
            expect(TimeUtils.toTimeStringWithSeconds(date)).toBe('14:30:45');
        });

        it('should pad single digit hours, minutes, and seconds', () => {
            const date = new Date('2025-01-22T09:05:03');
            expect(TimeUtils.toTimeStringWithSeconds(date)).toBe('09:05:03');
        });

        it('should handle midnight with seconds', () => {
            const date = new Date('2025-01-22T00:00:00');
            expect(TimeUtils.toTimeStringWithSeconds(date)).toBe('00:00:00');
        });

        it('should handle 23:59:59', () => {
            const date = new Date('2025-01-22T23:59:59');
            expect(TimeUtils.toTimeStringWithSeconds(date)).toBe('23:59:59');
        });
    });

    describe('compareTimeStrings', () => {
        it('should return -1 when time1 < time2', () => {
            expect(TimeUtils.compareTimeStrings('14:30', '15:00')).toBe(-1);
            expect(TimeUtils.compareTimeStrings('09:00', '09:30')).toBe(-1);
            expect(TimeUtils.compareTimeStrings('08:59', '09:00')).toBe(-1);
        });

        it('should return 0 when time1 == time2', () => {
            expect(TimeUtils.compareTimeStrings('14:30', '14:30')).toBe(0);
            expect(TimeUtils.compareTimeStrings('00:00', '00:00')).toBe(0);
            expect(TimeUtils.compareTimeStrings('23:59', '23:59')).toBe(0);
        });

        it('should return 1 when time1 > time2', () => {
            expect(TimeUtils.compareTimeStrings('15:00', '14:30')).toBe(1);
            expect(TimeUtils.compareTimeStrings('09:30', '09:00')).toBe(1);
            expect(TimeUtils.compareTimeStrings('09:00', '08:59')).toBe(1);
        });

        it('should handle edge cases', () => {
            expect(TimeUtils.compareTimeStrings('00:00', '23:59')).toBe(-1);
            expect(TimeUtils.compareTimeStrings('23:59', '00:00')).toBe(1);
        });
    });

    describe('parseEventTime', () => {
        it('should use time field if available', () => {
            const start = { time: '14:30' };
            expect(TimeUtils.parseEventTime(start)).toBe('14:30');
        });

        it('should parse dateTime if time is not available', () => {
            // Use local time instead of UTC to avoid timezone conversion issues
            const start = { dateTime: '2025-01-22T14:30:00' };
            expect(TimeUtils.parseEventTime(start)).toBe('14:30');
        });

        it('should prioritize time over dateTime', () => {
            const start = {
                time: '15:00',
                dateTime: '2025-01-22T14:30:00Z'
            };
            expect(TimeUtils.parseEventTime(start)).toBe('15:00');
        });

        it('should return 00:00 if neither time nor dateTime is available', () => {
            const start = {};
            expect(TimeUtils.parseEventTime(start)).toBe('00:00');
        });

        it('should handle dateTime with timezone', () => {
            const start = { dateTime: '2025-01-22T14:30:00+03:00' };
            // Note: Result depends on system timezone, so we just check format
            const result = TimeUtils.parseEventTime(start);
            expect(result).toMatch(/^\d{2}:\d{2}$/);
        });
    });

    describe('DRY Principle Verification', () => {
        it('should replace app.ts:635 pattern (event time extraction)', () => {
            // Old pattern: String(t.getHours()).padStart(2, '0') + ':' + String(t.getMinutes()).padStart(2, '0')
            const t = new Date('2025-01-22T14:30:00');

            // Old way (duplicated)
            const oldWay = String(t.getHours()).padStart(2, '0') + ':' + String(t.getMinutes()).padStart(2, '0');

            // New way (DRY)
            const newWay = TimeUtils.toTimeString(t);

            expect(newWay).toBe(oldWay);
            expect(newWay).toBe('14:30');
        });

        it('should replace app.ts:637 pattern (current time)', () => {
            const now = new Date('2025-01-22T16:45:30');

            // Old way
            const oldWay = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');

            // New way
            const newWay = TimeUtils.toTimeString(now);

            expect(newWay).toBe(oldWay);
            expect(newWay).toBe('16:45');
        });

        it('should replace admin-panel.ts:892-894 pattern', () => {
            const startDate = new Date('2025-01-22T09:15:00');

            // Old way (admin-panel.ts:892-894)
            const hours = String(startDate.getHours()).padStart(2, '0');
            const minutes = String(startDate.getMinutes()).padStart(2, '0');
            const oldWay = `${hours}:${minutes}`;

            // New way
            const newWay = TimeUtils.toTimeString(startDate);

            expect(newWay).toBe(oldWay);
            expect(newWay).toBe('09:15');
        });
    });

    describe('Integration with existing code', () => {
        it('should work with app.ts time comparison logic', () => {
            const now = new Date('2025-01-22T14:30:00');
            const eventDate = new Date('2025-01-22T15:00:00');

            const eventTime = TimeUtils.toTimeString(eventDate);
            const currentTime = TimeUtils.toTimeString(now);

            // app.ts:638 logic: if (eventTime < currentTime)
            expect(eventTime < currentTime).toBe(false);
            expect(TimeUtils.compareTimeStrings(eventTime, currentTime)).toBe(1);
        });

        it('should work with parseEventTime for calendar events', () => {
            const event = {
                start: {
                    time: '14:30'
                }
            };

            const eventTime = TimeUtils.parseEventTime(event.start);
            expect(eventTime).toBe('14:30');
        });
    });
});
