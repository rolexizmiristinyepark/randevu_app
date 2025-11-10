/**
 * TARİH FORMATLAMA YARDIMCI FONKSİYONLARI
 * Tüm tarih formatlamalarını tek bir yerde toplar
 */

interface IDateUtils {
    /** Türkçe ay isimleri */
    readonly MONTHS_TR: readonly string[];

    /** Türkçe gün isimleri */
    readonly DAYS_TR: readonly string[];

    /**
     * YYYY-MM-DD formatında tarih döndürür (local timezone)
     * @param date - Formatlanacak tarih
     * @returns YYYY-MM-DD formatında tarih
     */
    toLocalDate(date: Date): string;

    /**
     * ICS takvim formatında tarih döndürür (YYYYMMDDTHHmmss)
     * @param date - Formatlanacak tarih
     * @returns ICS formatında tarih
     */
    toICSDate(date: Date): string;

    /**
     * Türkçe okunabilir formatta tarih döndürür
     * Örnek: "12 Ekim 2025, Salı"
     * @param date - Formatlanacak tarih
     * @returns Türkçe formatında tarih
     */
    toTurkishDate(date: Date): string;
}

const DateUtils: IDateUtils = {
    // Türkçe ay isimleri
    MONTHS_TR: ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
                'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'] as const,

    // Türkçe gün isimleri
    DAYS_TR: ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'] as const,

    toLocalDate(date: Date): string {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    },

    toICSDate(date: Date): string {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        return `${year}${month}${day}T${hours}${minutes}${seconds}`;
    },

    toTurkishDate(date: Date): string {
        const day = date.getDate();
        const month = this.MONTHS_TR[date.getMonth()];
        const year = date.getFullYear();
        const dayName = this.DAYS_TR[date.getDay()];
        return `${day} ${month} ${year}, ${dayName}`;
    }
};

// Export for ES6 modules
export { DateUtils, type IDateUtils };

// Also expose globally for backward compatibility
if (typeof window !== 'undefined') {
    (window as unknown as { DateUtils: IDateUtils }).DateUtils = DateUtils;
}
