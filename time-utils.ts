/**
 * ZAMAN FORMATLAMA YARDIMCI FONKSİYONLARI
 * DRY Principle: Tek kaynak olarak zaman formatlamaları
 *
 * Bu modül önce:
 * - app.ts:635-637 (2 tekrar)
 * - admin-panel.ts:892-894 (1 tekrar)
 * Toplam 5+ kod tekrarını çözer
 */

interface ITimeUtils {
    /**
     * Tarihi HH:MM formatında string'e çevirir
     * @param date - Formatlanacak tarih
     * @returns HH:MM formatında string (örn: "14:30")
     * @example
     * const date = new Date('2025-01-22T14:30:00');
     * TimeUtils.toTimeString(date); // "14:30"
     */
    toTimeString(date: Date): string;

    /**
     * Tarihi HH:MM:SS formatında string'e çevirir
     * @param date - Formatlanacak tarih
     * @returns HH:MM:SS formatında string (örn: "14:30:45")
     * @example
     * const date = new Date('2025-01-22T14:30:45');
     * TimeUtils.toTimeStringWithSeconds(date); // "14:30:45"
     */
    toTimeStringWithSeconds(date: Date): string;

    /**
     * İki HH:MM formatındaki zamanı karşılaştırır
     * @param time1 - İlk zaman (HH:MM)
     * @param time2 - İkinci zaman (HH:MM)
     * @returns -1 if time1 < time2, 0 if equal, 1 if time1 > time2
     * @example
     * TimeUtils.compareTimeStrings("14:30", "15:00"); // -1
     * TimeUtils.compareTimeStrings("15:00", "15:00"); // 0
     * TimeUtils.compareTimeStrings("16:30", "15:00"); // 1
     */
    compareTimeStrings(time1: string, time2: string): number;

    /**
     * Date objesini HH:MM formatında string olarak parse eder
     * Eğer start.time varsa onu kullanır, yoksa dateTime'dan çeker
     * @param start - Google Calendar event start object
     * @returns HH:MM formatında string
     * @example
     * TimeUtils.parseEventTime({ time: "14:30" }); // "14:30"
     * TimeUtils.parseEventTime({ dateTime: "2025-01-22T14:30:00Z" }); // "14:30"
     */
    parseEventTime(start: { time?: string; dateTime?: string }): string;
}

const TimeUtils: ITimeUtils = {
    toTimeString(date: Date): string {
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${hours}:${minutes}`;
    },

    toTimeStringWithSeconds(date: Date): string {
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        return `${hours}:${minutes}:${seconds}`;
    },

    compareTimeStrings(time1: string, time2: string): number {
        if (time1 < time2) return -1;
        if (time1 > time2) return 1;
        return 0;
    },

    parseEventTime(start: { time?: string; dateTime?: string }): string {
        if (start.time) {
            return start.time;
        }
        if (start.dateTime) {
            const date = new Date(start.dateTime);
            return this.toTimeString(date);
        }
        return '00:00';
    }
};

// Export for ES6 modules
export { TimeUtils, type ITimeUtils };

// Also expose globally for backward compatibility
if (typeof window !== 'undefined') {
    (window as unknown as { TimeUtils: ITimeUtils }).TimeUtils = TimeUtils;
}
