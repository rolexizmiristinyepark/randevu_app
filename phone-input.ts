/**
 * Phone Input Utility - intl-tel-input wrapper
 * Telefon girişi için bayraklı, ülke aramalı, validation'lı input
 */

// CSS artık style.css içinden @import ile yükleniyor (aynı chunk'ta kalması için)
// import 'intl-tel-input/build/css/intlTelInput.css';

// Lazy-loaded intl-tel-input library (~90KB deferred until first phone input init)
let _intlTelInput: typeof import('intl-tel-input').default | null = null;

async function getIntlTelInput(): Promise<typeof import('intl-tel-input').default> {
    if (!_intlTelInput) {
        const module = await import('intl-tel-input');
        _intlTelInput = module.default;
    }
    return _intlTelInput;
}

// Set flag image paths based on Vite base URL
// This runs once when the module is loaded
function setFlagImagePaths(): void {
    // Get base URL from Vite (handles both dev and production)
    const baseUrl = (import.meta as any).env?.BASE_URL || '/';

    // Create a style element to set CSS variables
    const style = document.createElement('style');
    style.textContent = `
        .iti {
            --iti-path-flags-1x: url('${baseUrl}img/flags.webp');
            --iti-path-flags-2x: url('${baseUrl}img/flags@2x.webp');
            --iti-path-globe-1x: url('${baseUrl}img/globe.webp');
            --iti-path-globe-2x: url('${baseUrl}img/globe@2x.webp');
        }
    `;
    document.head.appendChild(style);
}

// Initialize flag paths when DOM is ready
if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setFlagImagePaths);
    } else {
        setFlagImagePaths();
    }
}

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
export async function initPhoneInput(
    inputId: string,
    options: {
        initialCountry?: string;
        preferredCountries?: string[];
        onlyCountries?: string[];
    } = {}
): Promise<IntlTelInputInstance | null> {
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

    // Lazy-load intl-tel-input library on first use
    const intlTelInput = await getIntlTelInput();

    // intl-tel-input TypeScript types are incomplete, using any for options
    const itiOptions: any = {
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
            zeroSearchResults: 'Sonuç bulunamadı',
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
    };
    const instance = intlTelInput(input, itiOptions) as IntlTelInputInstance;

    // Production build'de CSS chunk sıralaması değişebiliyor (Vite code-splitting).
    // intl-tel-input kütüphanesi .iti wrapper'ı display:inline-block yapıyor,
    // bizim override'ımız farklı chunk'ta kalınca ezilebiliyor.
    // JS ile inline !important set ederek CSS sıralamasından bağımsız çalışmasını sağlıyoruz.
    const itiWrapper = input.closest('.iti') as HTMLElement;
    if (itiWrapper) {
        itiWrapper.style.setProperty('display', 'block', 'important');
        itiWrapper.style.setProperty('width', '100%', 'important');
    }

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

/**
 * Format phone number for display (with + prefix)
 * @param number - Phone number (with or without +)
 * @returns Formatted number like +90 532 123 4567
 */
export function formatPhoneForDisplay(number: string): string {
    if (!number) return '';

    // Ensure + prefix
    const withPlus = number.startsWith('+') ? number : `+${number}`;

    // Basic formatting: +XX XXX XXX XX XX
    const digits = withPlus.replace(/\D/g, '');

    if (digits.length <= 2) return withPlus;
    if (digits.length <= 5) return `+${digits.slice(0, 2)} ${digits.slice(2)}`;
    if (digits.length <= 8) return `+${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5)}`;
    if (digits.length <= 10) return `+${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`;

    // For longer numbers: +XX XXX XXX XX XX
    return `+${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 8)} ${digits.slice(8, 10)} ${digits.slice(10)}`;
}

/**
 * Get phone number for WhatsApp API (without + and spaces)
 * @param number - Phone number (with or without +)
 * @returns Clean number like 905321234567
 */
export function formatPhoneForWhatsApp(number: string): string {
    if (!number) return '';
    // Remove all non-digits
    return number.replace(/\D/g, '');
}

// Export for global access
if (typeof window !== 'undefined') {
    (window as any).PhoneInput = {
        init: initPhoneInput,
        getNumber: getPhoneNumber,
        isValid: isPhoneValid,
        setNumber: setPhoneNumber,
        destroy: destroyPhoneInput,
        getCountry: getSelectedCountry,
        formatForDisplay: formatPhoneForDisplay,
        formatForWhatsApp: formatPhoneForWhatsApp
    };
}
