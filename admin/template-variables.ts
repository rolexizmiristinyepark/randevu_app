/**
 * TEMPLATE VARIABLES - Global şablon değişkenleri
 *
 * FAZ 9: WhatsApp ve E-posta şablonlarında kullanılabilecek değişkenler
 *
 * Kullanım: {{degisken_adi}} formatında şablona eklenir
 * Backend tarafından gönderim sırasında gerçek değerlerle değiştirilir
 */

// ==================== VARIABLE DEFINITION ====================

export interface TemplateVariable {
    key: string;           // Değişken adı ({{key}} formatında kullanılır)
    label: string;         // Türkçe görünen isim
    description: string;   // Açıklama
    systemField: string;   // Sistemdeki karşılığı
    example: string;       // Örnek değer
}

// ==================== GLOBAL VARIABLES ====================
// Sadece sistemde karşılığı olan değişkenler

export const TEMPLATE_VARIABLES: TemplateVariable[] = [
    // ========== MÜŞTERİ BİLGİLERİ ==========
    {
        key: 'musteri',
        label: 'Müşteri',
        description: 'Müşterinin adı soyadı',
        systemField: 'customerName',
        example: 'Ahmet Yılmaz'
    },
    {
        key: 'musteri_tel',
        label: 'Müşteri Tel',
        description: 'Müşterinin telefon numarası',
        systemField: 'customerPhone',
        example: '+90 532 123 4567'
    },
    {
        key: 'musteri_mail',
        label: 'Müşteri Mail',
        description: 'Müşterinin e-posta adresi',
        systemField: 'customerEmail',
        example: 'ahmet@email.com'
    },

    // ========== RANDEVU BİLGİLERİ ==========
    {
        key: 'randevu_tarih',
        label: 'Randevu Tarihi',
        description: 'Randevu tarihi ve günü',
        systemField: 'date', // Backend tarafından formatlanacak
        example: '20 Aralık 2025, Cumartesi'
    },
    {
        key: 'randevu_saat',
        label: 'Randevu Saati',
        description: 'Randevu başlangıç saati',
        systemField: 'time',
        example: '14:30'
    },
    {
        key: 'randevu_ek_bilgi',
        label: 'Randevu Ek Bilgi',
        description: 'Müşterinin randevu notu',
        systemField: 'customerNote',
        example: 'GMT-Master II ile ilgileniyorum'
    },
    {
        key: 'randevu_turu',
        label: 'Randevu Türü',
        description: 'Randevu türü',
        systemField: 'appointmentType',
        example: 'Satış Görüşmesi'
    },
    {
        key: 'randevu_profili',
        label: 'Randevu Profili',
        description: 'Randevu profili (Genel, Walk-in, Butik, Özel Müşteri vb.)',
        systemField: 'profile',
        example: 'Özel Müşteri'
    },

    // ========== PERSONEL BİLGİLERİ ==========
    {
        key: 'personel',
        label: 'Personel',
        description: 'Atanan personelin adı soyadı',
        systemField: 'staffName',
        example: 'Mehmet Kaya'
    },
    {
        key: 'personel_tel',
        label: 'Personel Tel',
        description: 'Personelin telefon numarası',
        systemField: 'staffPhone',
        example: '+90 532 987 6543'
    },
    {
        key: 'personel_mail',
        label: 'Personel Mail',
        description: 'Personelin e-posta adresi',
        systemField: 'staffEmail',
        example: 'mehmet@rolex.com'
    }
];

// ==================== HELPER FUNCTIONS ====================

/**
 * Get all variable keys
 */
export function getAllVariableKeys(): string[] {
    return TEMPLATE_VARIABLES.map(v => v.key);
}

/**
 * Format variable for template usage
 */
export function formatVariable(key: string): string {
    return `{{${key}}}`;
}

/**
 * Extract variable keys from template text using matchAll
 */
export function extractVariables(templateText: string): string[] {
    const regex = /\{\{([a-z_]+)\}\}/g;
    const matches = templateText.matchAll(regex);
    const result: string[] = [];

    for (const match of matches) {
        if (!result.includes(match[1])) {
            result.push(match[1]);
        }
    }

    return result;
}

/**
 * Validate that all variables in template exist
 */
export function validateTemplateVariables(templateText: string): {
    valid: boolean;
    unknownVariables: string[];
} {
    const usedVariables = extractVariables(templateText);
    const validKeys = TEMPLATE_VARIABLES.map(v => v.key);

    const unknownVariables = usedVariables.filter(v => !validKeys.includes(v));

    return {
        valid: unknownVariables.length === 0,
        unknownVariables
    };
}

/**
 * Generate preview with example values
 */
export function generatePreview(templateText: string): string {
    let preview = templateText;

    TEMPLATE_VARIABLES.forEach(variable => {
        const pattern = new RegExp(`\\{\\{${variable.key}\\}\\}`, 'g');
        preview = preview.replace(pattern, variable.example);
    });

    return preview;
}

/**
 * Get variable by key
 */
export function getVariableByKey(key: string): TemplateVariable | undefined {
    return TEMPLATE_VARIABLES.find(v => v.key === key);
}

// Export for global window access
if (typeof window !== 'undefined') {
    (window as any).TemplateVariables = {
        all: TEMPLATE_VARIABLES,
        keys: getAllVariableKeys,
        format: formatVariable,
        extract: extractVariables,
        validate: validateTemplateVariables,
        preview: generatePreview,
        getByKey: getVariableByKey
    };
}
