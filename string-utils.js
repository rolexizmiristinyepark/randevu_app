/**
 * STRING FORMATLAMA YARDIMCI FONKSİYONLARI
 * Tüm string formatlamalarını tek bir yerde toplar
 */

const StringUtils = {
    /**
     * Metni title case formatına çevirir (Her Kelimenin İlk Harfi Büyük)
     * Türkçe karakter desteği ile çalışır
     *
     * @param {string} str - Formatlanacak metin
     * @returns {string} Title case formatında metin
     *
     * @example
     * StringUtils.toTitleCase('ahmet mehmet') // => 'Ahmet Mehmet'
     * StringUtils.toTitleCase('şükran çiğdem') // => 'Şükran Çiğdem'
     */
    toTitleCase(str) {
        if (!str) return str;
        return str
            .toLowerCase()
            .split(' ')
            .map(word => word.charAt(0).toLocaleUpperCase('tr-TR') + word.slice(1))
            .join(' ');
    }
};

// Export for ES6 modules
export { StringUtils };

// Also expose globally for backward compatibility
if (typeof window !== 'undefined') {
    window.StringUtils = StringUtils;
}
