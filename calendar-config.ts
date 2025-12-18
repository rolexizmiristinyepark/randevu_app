// ==================== CALENDAR & ICS CONFIGURATION ====================
// Single source of truth for appointment type names and ICS templates
// Used by both frontend (calendar-integration.ts) and backend (apps-script-backend.js)
// ⚠️ Backend must manually sync these constants (Apps Script can't import TS)

export const CALENDAR_CONFIG = {
    // Appointment type display names (customer-facing)
    APPOINTMENT_TYPE_NAMES: {
        'delivery': 'Saat Takdimi',
        'service': 'Servis & Bakım',
        'consultation': 'Ürün Danışmanlığı',
        'general': 'Genel Görüşme',
        'meeting': 'Genel Görüşme',      // Alias for 'general'
        'management': 'Yönetim',
        'shipping': 'Gönderi'
    },

    // ICS file metadata
    ICS_METADATA: {
        PRODID: '-//Rolex İzmir İstinyepark//Randevu Sistemi//TR',
        ORGANIZER_NAME: 'Rolex İzmir İstinyepark',
        SECTION_TITLE: 'RANDEVU BİLGİLERİ'
    },

    // ICS description field labels
    ICS_LABELS: {
        CONTACT_PERSON: 'İlgili',
        CONTACT: 'İletişim',
        EMAIL: 'E-posta',
        DATE: 'Tarih',
        TIME: 'Saat',
        SUBJECT: 'Konu',
        NOTES: 'Ek Bilgi'
    },

    // Dynamic reminders based on appointment type
    ICS_REMINDERS: {
        ON_TIME: 'Randevunuza zamanında gelmenizi rica ederiz.',
        BRING_ID: 'Lütfen kimlik belgenizi yanınızda bulundurun.',
        BRING_WATCH: 'Lütfen saatinizi ve ilgili belgeleri yanınızda getirin.'
    }
};

// Convenience export for appointment type names
export const APPOINTMENT_TYPE_NAMES = CALENDAR_CONFIG.APPOINTMENT_TYPE_NAMES;
