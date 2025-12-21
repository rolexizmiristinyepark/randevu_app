/**
 * STRING FORMATLAMA YARDIMCI FONKSİYONLARI
 * Tüm string formatlamalarını tek bir yerde toplar
 */

interface IStringUtils {
    /**
     * Metni title case formatına çevirir (Her Kelimenin İlk Harfi Büyük)
     * Türkçe karakter desteği ile çalışır
     *
     * @param str - Formatlanacak metin
     * @returns Title case formatında metin
     *
     * @example
     * StringUtils.toTitleCase('ahmet mehmet') // => 'Ahmet Mehmet'
     * StringUtils.toTitleCase('şükran çiğdem') // => 'Şükran Çiğdem'
     */
    toTitleCase(str: string | null | undefined): string | null | undefined;
}

const StringUtils: IStringUtils = {
    toTitleCase(str) {
        if (!str) return str;
        return str
            // v3.9: Türkçe İ/I desteği için toLocaleLowerCase kullan
            // toLowerCase() İ'yi yanlış çeviriyor: İ → i̇ (combining dot)
            // toLocaleLowerCase('tr-TR') doğru çeviriyor: İ → i
            .toLocaleLowerCase('tr-TR')
            .split(' ')
            .map(word => word.charAt(0).toLocaleUpperCase('tr-TR') + word.slice(1))
            .join(' ');
    }
};

// Export for ES6 modules
export { StringUtils, type IStringUtils };

// Also expose globally for backward compatibility
if (typeof window !== 'undefined') {
    (window as unknown as { StringUtils: IStringUtils }).StringUtils = StringUtils;
}
