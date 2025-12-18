/**
 * Phone Input Utility - intl-tel-input wrapper
 * Telefon girişi için bayraklı, ülke aramalı, validation'lı input
 */

import intlTelInput from 'intl-tel-input';
import 'intl-tel-input/build/css/intlTelInput.css';

// Type definitions
interface IntlTelInputInstance {
    getNumber(): string;
    getSelectedCountryData(): { iso2: string; dialCode: string; name: string };
    isValidNumber(): boolean;
    setNumber(number: string): void;
    destroy(): void;
}

// Store instances for cleanup
const instances: Map<string, IntlTelInputInstance> = new Map();

/**
 * Initialize phone input with intl-tel-input
 * @param inputId - Input element ID
 * @param options - Optional configuration
 * @returns Instance for getting value later
 */
export function initPhoneInput(
    inputId: string,
    options: {
        initialCountry?: string;
        preferredCountries?: string[];
        onlyCountries?: string[];
    } = {}
): IntlTelInputInstance | null {
    const input = document.getElementById(inputId) as HTMLInputElement;
    if (!input) {
        console.error(`Phone input not found: ${inputId}`);
        return null;
    }

    // Destroy existing instance if any
    if (instances.has(inputId)) {
        instances.get(inputId)?.destroy();
        instances.delete(inputId);
    }

    const instance = intlTelInput(input, {
        initialCountry: options.initialCountry || 'tr',
        preferredCountries: options.preferredCountries || ['tr', 'de', 'gb', 'us', 'fr'],
        separateDialCode: true,
        nationalMode: false,
        formatOnDisplay: true,
        autoPlaceholder: 'aggressive',
        loadUtils: () => import('intl-tel-input/utils'),
        countrySearch: true,
        i18n: {
            searchPlaceholder: 'Ara...',
            noResultsFound: 'Sonuç bulunamadı',
            // Turkish country names
            tr: 'Türkiye',
            de: 'Almanya',
            gb: 'Birleşik Krallık',
            us: 'Amerika Birleşik Devletleri',
            fr: 'Fransa',
            it: 'İtalya',
            es: 'İspanya',
            nl: 'Hollanda',
            be: 'Belçika',
            at: 'Avusturya',
            ch: 'İsviçre',
            se: 'İsveç',
            no: 'Norveç',
            dk: 'Danimarka',
            pl: 'Polonya',
            gr: 'Yunanistan',
            eg: 'Mısır',
            za: 'Güney Afrika',
            in: 'Hindistan',
            cn: 'Çin',
            jp: 'Japonya',
            kr: 'Güney Kore',
            au: 'Avustralya',
            nz: 'Yeni Zelanda',
            br: 'Brezilya',
            mx: 'Meksika',
            ar: 'Arjantin',
            co: 'Kolombiya',
            cl: 'Şili',
            ru: 'Rusya',
            ua: 'Ukrayna',
            ae: 'Birleşik Arap Emirlikleri',
            sa: 'Suudi Arabistan',
            qa: 'Katar',
            kw: 'Kuveyt',
            bh: 'Bahreyn',
            om: 'Umman',
            fi: 'Finlandiya',
            ma: 'Fas',
            dz: 'Cezayir',
            tn: 'Tunus',
        }
    }) as IntlTelInputInstance;

    instances.set(inputId, instance);
    return instance;
}

/**
 * Get phone number from input (E.164 format without +)
 * @param inputId - Input element ID
 * @returns Phone number like 905321234567
 */
export function getPhoneNumber(inputId: string): string {
    const instance = instances.get(inputId);
    if (!instance) return '';

    // getNumber returns E.164 format like +905321234567
    const number = instance.getNumber();
    // Remove + prefix for storage
    return number.replace(/^\+/, '');
}

/**
 * Check if phone number is valid
 * @param inputId - Input element ID
 * @returns true if valid
 */
export function isPhoneValid(inputId: string): boolean {
    const instance = instances.get(inputId);
    if (!instance) return false;
    return instance.isValidNumber();
}

/**
 * Set phone number in input
 * @param inputId - Input element ID
 * @param number - Phone number (with or without country code)
 */
export function setPhoneNumber(inputId: string, number: string): void {
    const instance = instances.get(inputId);
    if (!instance || !number) return;

    // Ensure number has + prefix for setNumber
    const formattedNumber = number.startsWith('+') ? number : `+${number}`;
    instance.setNumber(formattedNumber);
}

/**
 * Destroy phone input instance
 * @param inputId - Input element ID
 */
export function destroyPhoneInput(inputId: string): void {
    const instance = instances.get(inputId);
    if (instance) {
        instance.destroy();
        instances.delete(inputId);
    }
}

/**
 * Get selected country data
 * @param inputId - Input element ID
 * @returns Country data object
 */
export function getSelectedCountry(inputId: string): { iso2: string; dialCode: string; name: string } | null {
    const instance = instances.get(inputId);
    if (!instance) return null;
    return instance.getSelectedCountryData();
}

// Export for global access
if (typeof window !== 'undefined') {
    (window as any).PhoneInput = {
        init: initPhoneInput,
        getNumber: getPhoneNumber,
        isValid: isPhoneValid,
        setNumber: setPhoneNumber,
        destroy: destroyPhoneInput,
        getCountry: getSelectedCountry
    };
}
