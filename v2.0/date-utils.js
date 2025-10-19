/**
 * TARİH FORMATLAMA YARDIMCI FONKSİYONLARI
 * Tüm tarih formatlamalarını tek bir yerde toplar
 */

const DateUtils = {
    // Türkçe ay isimleri
    MONTHS_TR: ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
                'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'],

    // Türkçe gün isimleri
    DAYS_TR: ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'],

    /**
     * YYYY-MM-DD formatında tarih döndürür (local timezone)
     * @param {Date} date - Formatlanacak tarih
     * @returns {string} YYYY-MM-DD formatında tarih
     */
    toLocalDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    },

    /**
     * ICS takvim formatında tarih döndürür (YYYYMMDDTHHmmss)
     * @param {Date} date - Formatlanacak tarih
     * @returns {string} ICS formatında tarih
     */
    toICSDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        return `${year}${month}${day}T${hours}${minutes}${seconds}`;
    },

    /**
     * Türkçe okunabilir formatta tarih döndürür
     * Örnek: "12 Ekim 2025, Salı"
     * @param {Date} date - Formatlanacak tarih
     * @returns {string} Türkçe formatında tarih
     */
    toTurkishDate(date) {
        const day = date.getDate();
        const month = this.MONTHS_TR[date.getMonth()];
        const year = date.getFullYear();
        const dayName = this.DAYS_TR[date.getDay()];
        return `${day} ${month} ${year}, ${dayName}`;
    }
};

// Export for ES6 modules
export { DateUtils };

// Also expose globally for backward compatibility
if (typeof window !== 'undefined') {
    window.DateUtils = DateUtils;
}
