/**
 * FORM VALIDATION YARDIMCI FONKSİYONLARI
 * DRY Principle: Tek kaynak olarak form validasyonları
 *
 * Bu modül önce:
 * - admin-panel.ts:153, 158, 163 (staff form 1)
 * - admin-panel.ts:409, 414, 419 (staff form 2)
 * - admin-panel.ts:463, 516, 907, 925, 997, 1486 (diğer validasyonlar)
 * Toplam 12+ kod tekrarını çözer
 */

interface ValidationResult {
    valid: boolean;
    message: string;
}

interface IValidationUtils {
    /**
     * Boş alan kontrolü yapar
     * @param value - Kontrol edilecek değer
     * @param fieldName - Alan adı (hata mesajında kullanılır)
     * @returns { valid: boolean, message: string }
     * @example
     * ValidationUtils.validateRequired("", "isim");
     * // { valid: false, message: "❌ Lütfen isim girin!" }
     *
     * ValidationUtils.validateRequired("Serdar", "isim");
     * // { valid: true, message: "" }
     */
    validateRequired(value: string | null | undefined, fieldName: string): ValidationResult;

    /**
     * E-posta formatı kontrolü
     * @param email - Kontrol edilecek e-posta
     * @returns { valid: boolean, message: string }
     * @example
     * ValidationUtils.validateEmail("invalid");
     * // { valid: false, message: "❌ Geçersiz e-posta formatı!" }
     *
     * ValidationUtils.validateEmail("serdar@rolex.com");
     * // { valid: true, message: "" }
     */
    validateEmail(email: string | null | undefined): ValidationResult;

    /**
     * Türk telefon numarası formatı kontrolü
     * Kabul edilen formatlar: 0555 123 45 67, 05551234567, +90 555 123 45 67
     * @param phone - Kontrol edilecek telefon
     * @returns { valid: boolean, message: string }
     * @example
     * ValidationUtils.validatePhone("123");
     * // { valid: false, message: "❌ Geçersiz telefon formatı! (örn: 0555 123 45 67)" }
     *
     * ValidationUtils.validatePhone("0555 123 45 67");
     * // { valid: true, message: "" }
     */
    validatePhone(phone: string | null | undefined): ValidationResult;

    /**
     * Tüm zorunlu alanları tek seferde kontrol eder
     * @param fields - { fieldName: value } object
     * @returns { valid: boolean, message: string }
     * @example
     * ValidationUtils.validateAllRequired({
     *   "isim": "",
     *   "telefon": "0555 123 45 67",
     *   "e-posta": "test@example.com"
     * });
     * // { valid: false, message: "❌ Lütfen isim girin!" }
     */
    validateAllRequired(fields: Record<string, string | null | undefined>): ValidationResult;

    /**
     * Staff form validasyonu (isim, telefon, e-posta)
     * @param name - İsim
     * @param phone - Telefon
     * @param email - E-posta
     * @returns { valid: boolean, message: string }
     */
    validateStaffForm(
        name: string | null | undefined,
        phone: string | null | undefined,
        email: string | null | undefined
    ): ValidationResult;
}

const ValidationUtils: IValidationUtils = {
    validateRequired(value: string | null | undefined, fieldName: string): ValidationResult {
        const trimmed = value?.trim() || '';
        if (trimmed.length === 0) {
            return {
                valid: false,
                message: `❌ Lütfen ${fieldName} girin!`
            };
        }
        return {
            valid: true,
            message: ''
        };
    },

    validateEmail(email: string | null | undefined): ValidationResult {
        const trimmed = email?.trim() || '';

        // Boş kontrolü
        if (trimmed.length === 0) {
            return {
                valid: false,
                message: '❌ Lütfen e-posta girin!'
            };
        }

        // Format kontrolü: basit regex (RFC 5322'nin basitleştirilmiş hali)
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(trimmed)) {
            return {
                valid: false,
                message: '❌ Geçersiz e-posta formatı!'
            };
        }

        return {
            valid: true,
            message: ''
        };
    },

    validatePhone(phone: string | null | undefined): ValidationResult {
        const cleaned = phone?.replace(/\s/g, '') || '';

        // Boş kontrolü
        if (cleaned.length === 0) {
            return {
                valid: false,
                message: '❌ Lütfen telefon girin!'
            };
        }

        // Türk telefon formatları:
        // - 905551234567 (12 hane - ülke kodu ile, + olmadan)
        // - +905551234567 (12 hane + işareti ile)
        // - 05551234567 (11 hane - başında 0 ile)
        // - 5551234567 (10 hane - sadece numara)
        const phoneRegex = /^(\+?90|0)?5\d{9}$/;
        if (!phoneRegex.test(cleaned)) {
            return {
                valid: false,
                message: '❌ Geçersiz telefon formatı! (örn: 0555 123 45 67)'
            };
        }

        return {
            valid: true,
            message: ''
        };
    },

    validateAllRequired(fields: Record<string, string | null | undefined>): ValidationResult {
        for (const [fieldName, value] of Object.entries(fields)) {
            const result = this.validateRequired(value, fieldName);
            if (!result.valid) {
                return result;
            }
        }
        return {
            valid: true,
            message: ''
        };
    },

    validateStaffForm(
        name: string | null | undefined,
        phone: string | null | undefined,
        email: string | null | undefined
    ): ValidationResult {
        // İsim kontrolü
        const nameResult = this.validateRequired(name, 'isim');
        if (!nameResult.valid) {
            return nameResult;
        }

        // Telefon kontrolü
        const phoneResult = this.validatePhone(phone);
        if (!phoneResult.valid) {
            return phoneResult;
        }

        // E-posta kontrolü
        const emailResult = this.validateEmail(email);
        if (!emailResult.valid) {
            return emailResult;
        }

        return {
            valid: true,
            message: ''
        };
    }
};

// Export for ES6 modules
export { ValidationUtils, type IValidationUtils, type ValidationResult };

// Also expose globally for backward compatibility
if (typeof window !== 'undefined') {
    (window as unknown as { ValidationUtils: IValidationUtils }).ValidationUtils = ValidationUtils;
}
